// Pairing files per app, for the Apps page's Pairing files dialog: the pairing apps IPAForge knows (their files'
// paths are known, SideStore's remote one too) and the other apps IPAForge installed (a path the user gives, kept per
// device). Placing writes this computer's pairing file; removing deletes it; a new remote pairing replaces
// SideStore's. The file grants access to the device, so it only ever goes into an app the user picked.
import { listInstalledApps } from '@installer/application/installed/list-installed.ts'
import {
  classicPairingOf,
  remotePairingOf,
  usesRemotePairing
} from '@installer/application/pairing/pairing-state.ts'
import {
  DEFAULT_PAIRING_PATH,
  isPairingPath
} from '@installer/domain/pairing-path.ts'
import type { InstalledApp } from '@installer/domain/types.ts'
import type {
  AppPairing,
  PairingQuery,
  PairingTargetQuery,
  PlacePairingInput
} from '@installer/engine/types.ts'
import type { InstallerDeps } from '@installer/types.ts'
import {
  type AppFileTarget,
  type DeviceHandle,
  findPairingApps,
  type PairingApp
} from '@ipaforge/device'
import {
  compact,
  ErrorCode,
  IPAForgeError,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

type PairingApps = {
  readonly known: readonly { app: PairingApp; installed: InstalledApp }[]
  readonly own: readonly InstalledApp[]
}

const pathsKey = (udid: string) => `pairing-paths/${udid}`

/** The paths given for own apps on a device, by bundle id. */
const readPaths = async (
  deps: Pick<InstallerDeps, 'installed'>,
  udid: string
): Promise<Record<string, string>> => {
  const bytes = await deps.installed.get(pathsKey(udid))
  if (!bytes) return {}
  try {
    const parsed: unknown = JSON.parse(utf8Decode(bytes))

    return typeof parsed === 'object' && parsed !== null
      ? Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, string] =>
              typeof entry[1] === 'string' && isPairingPath(entry[1])
          )
        )
      : {}
  } catch {
    return {}
  }
}

const writePaths = (
  deps: Pick<InstallerDeps, 'installed'>,
  udid: string,
  paths: Record<string, string>
) => deps.installed.set(pathsKey(udid), utf8Encode(JSON.stringify(paths)))

/** The device's apps signed by the teams: the known pairing apps, and the others IPAForge installed (record or mark). */
const pairingAppsOn = async (
  deps: InstallerDeps,
  { udid, teamIds }: PairingQuery
): Promise<PairingApps> => {
  const installed = await listInstalledApps(deps, udid, teamIds)
  const known = findPairingApps(
    installed.map((app) => app.bundleId),
    { teamIds }
  ).flatMap(({ app, bundleId }) => {
    const match = installed.find((candidate) => candidate.bundleId === bundleId)

    return match ? [{ app, installed: match }] : []
  })
  const knownIds = new Set(known.map(({ installed: app }) => app.bundleId))

  return {
    known,
    own: installed.filter(
      (app) =>
        !knownIds.has(app.bundleId) &&
        (app.record !== undefined || app.marker !== undefined)
    )
  }
}

const targetsOf = (bundleId: string, paths: readonly string[]) =>
  paths.map((path): AppFileTarget => ({ bundleId, path }))

const withHandle = async <T>(
  deps: InstallerDeps,
  udid: string,
  use: (handle: DeviceHandle) => Promise<T>
): Promise<T> => {
  const handle = await deps.devices.open(udid, { autoPair: false })
  try {
    return await use(handle)
  } finally {
    await handle.close()
  }
}

/** Every pairing app and other app IPAForge installed on the device, with whose pairing files each holds. */
export const pairingFiles = async (
  deps: InstallerDeps,
  query: PairingQuery
): Promise<AppPairing[]> => {
  const { known, own } = await pairingAppsOn(deps, query)
  const paths = await readPaths(deps, query.udid)

  return withHandle(deps, query.udid, async (handle) => {
    const remoteOn = usesRemotePairing(
      (await handle.session.info()).productVersion
    )
    const knownRows: AppPairing[] = []
    for (const { app, installed } of known) {
      const classic = await classicPairingOf(
        handle,
        targetsOf(installed.bundleId, app.files)
      )
      const remoteFiles = app.remoteFiles ?? []
      knownRows.push(
        compact({
          bundleId: installed.bundleId,
          name: installed.name,
          kind: 'known' as const,
          classic: classic.state,
          placedAt: classic.placedAt,
          remote:
            remoteOn && remoteFiles.length > 0
              ? await remotePairingOf(
                  handle,
                  targetsOf(installed.bundleId, remoteFiles)
                )
              : undefined
        })
      )
    }
    const ownRows: AppPairing[] = []
    for (const app of own) {
      const path = paths[app.bundleId]
      const classic = path
        ? await classicPairingOf(handle, targetsOf(app.bundleId, [path]))
        : { state: 'missing' as const }
      ownRows.push(
        compact({
          bundleId: app.bundleId,
          name: app.name,
          kind: 'own' as const,
          classic: classic.state,
          placedAt: 'placedAt' in classic ? classic.placedAt : undefined,
          path: classic.state === 'missing' ? undefined : path
        })
      )
    }

    return [...knownRows, ...ownRows]
  })
}

const notOffered = (bundleId: string) =>
  new IPAForgeError(ErrorCode.PairingAppNotFound, {
    message: 'not a pairing app or an app IPAForge installed',
    data: { bundleId }
  })

/** Where an app's pairing files go: a known app's own paths (and remote ones), or the path given for an own app. */
const placesFor = async (
  deps: InstallerDeps,
  query: PairingTargetQuery,
  path: string | undefined
): Promise<
  | { readonly kind: 'known'; readonly app: PairingApp }
  | { readonly kind: 'own'; readonly path: string }
> => {
  const { known, own } = await pairingAppsOn(deps, query)
  const match = known.find(
    ({ installed }) => installed.bundleId === query.bundleId
  )
  if (match) return { kind: 'known', app: match.app }
  if (!own.some((app) => app.bundleId === query.bundleId))
    throw notOffered(query.bundleId)
  const ownPath =
    path ??
    (await readPaths(deps, query.udid))[query.bundleId] ??
    DEFAULT_PAIRING_PATH
  if (!isPairingPath(ownPath))
    throw new IPAForgeError(ErrorCode.PairingPathInvalid, {
      data: { path: ownPath }
    })

  return { kind: 'own', path: ownPath }
}

/**
 * Writes this computer's pairing file into one app: a known app at its paths (SideStore's remote one too, on iOS
 * 17.4 and later), an own app at the path given (remembered for next time, the old file removed when it moved).
 */
export const placeAppPairing = async (
  deps: InstallerDeps,
  input: PlacePairingInput
): Promise<void> => {
  const place = await placesFor(deps, input, input.path)
  if (place.kind === 'known') {
    await withHandle(deps, input.udid, (handle) =>
      handle.placePairingFile(targetsOf(input.bundleId, place.app.files))
    )
    return
  }
  const paths = await readPaths(deps, input.udid)
  const previous = paths[input.bundleId]
  await withHandle(deps, input.udid, async (handle) => {
    await handle.placePairingFile(targetsOf(input.bundleId, [place.path]), {
      remotePairing: false
    })
    if (previous && previous !== place.path)
      await handle.removeAppFile({ bundleId: input.bundleId, path: previous })
  })
  await writePaths(deps, input.udid, { ...paths, [input.bundleId]: place.path })
  deps.logger.info('pairing file placed in an app IPAForge installed', {
    bundleId: input.bundleId,
    path: place.path
  })
}

/** Deletes an app's pairing files: a known app's classic and remote ones, or the one at an own app's path. */
export const removeAppPairing = async (
  deps: InstallerDeps,
  query: PairingTargetQuery
): Promise<void> => {
  const place = await placesFor(deps, query, undefined)
  const paths =
    place.kind === 'known'
      ? [...place.app.files, ...(place.app.remoteFiles ?? [])]
      : [place.path]
  await withHandle(deps, query.udid, async (handle) => {
    for (const target of targetsOf(query.bundleId, paths))
      await handle.removeAppFile(target)
  })
  if (place.kind === 'own') {
    const { [query.bundleId]: _, ...rest } = await readPaths(deps, query.udid)
    await writePaths(deps, query.udid, rest)
  }
  deps.logger.info('pairing files removed from an app', {
    bundleId: query.bundleId,
    files: paths.length
  })
}

/**
 * Makes a new remote pairing with the device (it may ask to Trust this computer again) and places it, with the
 * classic file, in every installed app that reads one. The old remote pairing stops working.
 */
export const newRemotePairing = async (
  deps: InstallerDeps,
  query: PairingQuery
): Promise<void> => {
  const { known } = await pairingAppsOn(deps, query)
  const readers = known.filter(({ app }) => (app.remoteFiles ?? []).length > 0)
  if (readers.length === 0)
    throw new IPAForgeError(ErrorCode.PairingAppNotFound, {
      message: 'no installed app reads a remote pairing file'
    })
  await withHandle(deps, query.udid, (handle) =>
    handle.placePairingFile(
      readers.flatMap(({ app, installed }) =>
        targetsOf(installed.bundleId, app.files)
      ),
      { newRemotePairing: true }
    )
  )
}

/** This computer's pairing file for the device (an XML plist), for another tool that asks for it (saved by the host). */
export const devicePairingFile = (
  deps: InstallerDeps,
  udid: string
): Promise<string> =>
  withHandle(deps, udid, async (handle) =>
    utf8Decode(await handle.pairingFileData())
  )

// Repair SideStore's check: what keeps SideStore on a device from refreshing apps by itself. It reads the device (its
// lock and Developer Mode, the installed SideStore with its profile, IPAForge mark and the certificate inside it,
// and the pairing file in its Documents) and asks Apple which of the team's certificates still sign.
import { listInstalledApps } from '@installer/application/installed/list-installed.ts'
import { validCertificateSerials } from '@installer/application/installed/valid-certificates.ts'
import { createFlowRuntime } from '@installer/application/runtime.ts'
import { queryTeam } from '@installer/application/team.ts'
import type {
  InstalledApp,
  SideStoreCheck,
  SideStoreHealth,
  SideStoreSigner
} from '@installer/domain/types.ts'
import {
  CERTIFICATE_ID_KEY,
  SIDESTORE_BUNDLE_ID
} from '@installer/sidestore/constants.ts'
import type { InstallerDeps } from '@installer/types.ts'
import type { DeveloperServices, Team } from '@ipaforge/apple'
import type { Channel } from '@ipaforge/catalog'
import { type DeviceHandle, PAIRING_APPS } from '@ipaforge/device'
import { compact, isPlistDict, parsePlist, stringAt } from '@ipaforge/kernel'

export type CheckSideStoreQuery = {
  readonly udid: string
  readonly accountId: string
  readonly teamId?: string
}

const SIDESTORE_APP_ID = 'sidestore'
const DEFAULT_CHANNEL: Channel = 'stable'

/** SideStore's bundle id as installed: its own, or sideloaded as `<id>.<TEAMID>`. */
const isSideStore = (bundleId: string): boolean =>
  bundleId === SIDESTORE_BUNDLE_ID ||
  bundleId.startsWith(`${SIDESTORE_BUNDLE_ID}.`)

const teamIdOf = (bundleId: string): string =>
  bundleId.slice(SIDESTORE_BUNDLE_ID.length + 1)

/** The pairing file in SideStore's Documents: whose it is, by the host id this computer pairs with. */
const pairingOf = async (
  handle: DeviceHandle,
  bundleId: string
): Promise<SideStoreHealth['pairing']> => {
  const files =
    PAIRING_APPS.find((app) => app.id === SIDESTORE_APP_ID)?.files ?? []
  const targets = files.map((path) => ({ bundleId, path }))
  const present = (await handle.appFileStatus(targets)).filter(
    (status) => status.exists
  )
  const [first] = present

  if (!first) return 'missing'

  const file = parsePlist(await handle.readAppFile(first.target))
  const hostId = isPlistDict(file) ? stringAt(file, 'HostID') : undefined

  return hostId?.toUpperCase() === handle.pairRecord.hostId.toUpperCase()
    ? 'this-computer'
    : 'other-computer'
}

/** The latest version on SideStore's channel; undefined when the catalog can't be reached. */
const latestVersion = async (
  deps: InstallerDeps,
  channel: Channel
): Promise<string | undefined> => {
  try {
    return (await deps.catalog.resolve(SIDESTORE_APP_ID, channel)).version
  } catch {
    return undefined
  }
}

const channelOf = (app: InstalledApp | undefined): Channel => {
  const origin = app?.record?.origin ?? app?.marker?.origin

  return origin?.kind === 'catalog' && origin.channel
    ? origin.channel
    : DEFAULT_CHANNEL
}

const signerOf = (
  teamId: string,
  team: Team,
  teams: readonly Team[]
): SideStoreSigner => {
  if (teamId === team.id) return 'team'

  return teams.some((candidate) => candidate.id === teamId)
    ? 'other-team'
    : 'other-apple-id'
}

/** The certificates of the team that signed it, when it's one of the Apple ID's teams. */
const serialsFor = async (
  deps: InstallerDeps,
  developer: DeveloperServices,
  teams: readonly Team[],
  teamId: string
): Promise<ReadonlySet<string> | undefined> => {
  const signer = teams.find((candidate) => candidate.id === teamId)

  return signer ? validCertificateSerials(deps, developer, signer) : undefined
}

const signingOf = (
  app: InstalledApp | undefined,
  valid: ReadonlySet<string> | undefined
): SideStoreHealth['signing'] => {
  const serial = app?.marker?.certificateSerial

  if (!(serial && valid)) return 'unknown'

  return valid.has(serial.toUpperCase()) ? 'valid' : 'revoked'
}

const ownCertificateOf = (
  serial: string | undefined,
  valid: ReadonlySet<string> | undefined
): SideStoreHealth['ownCertificate'] => {
  if (!serial) return 'missing'

  return valid?.has(serial.toUpperCase()) ? 'valid' : 'other'
}

export const checkSideStore = async (
  deps: InstallerDeps,
  query: CheckSideStoreQuery
): Promise<SideStoreCheck> => {
  const developer = await createFlowRuntime(deps).developer(query.accountId)
  const teams = await developer.teams()
  const team = await queryTeam(deps, developer, {
    accountId: query.accountId,
    requested: query.teamId
  })
  const handle = await deps.devices.open(query.udid, { autoPair: false })

  try {
    const { locked, developerMode } = await handle.check()

    // A locked device keeps its apps' containers closed: there's nothing more to read until it's unlocked.
    if (locked) return { locked, developerMode }

    const installed = (await handle.listApps('User')).find((app) =>
      isSideStore(app.bundleId)
    )

    if (!installed) return { locked, developerMode }

    const teamId = teamIdOf(installed.bundleId)
    const listed = (
      await listInstalledApps(
        deps,
        query.udid,
        teams.map((candidate) => candidate.id)
      )
    ).find((app) => app.bundleId === installed.bundleId)
    const valid = await serialsFor(deps, developer, teams, teamId)
    const channel = channelOf(listed)

    return {
      locked,
      developerMode,
      sideStore: compact({
        bundleId: installed.bundleId,
        version: installed.shortVersion ?? installed.version,
        latest: await latestVersion(deps, channel),
        channel,
        signedBy: signerOf(teamId, team, teams),
        expiresAt: listed?.expiresAt,
        signing: signingOf(listed, valid),
        ownCertificate: ownCertificateOf(
          stringAt(installed.raw, CERTIFICATE_ID_KEY),
          valid
        ),
        pairing: await pairingOf(handle, installed.bundleId)
      })
    }
  } finally {
    await handle.close()
  }
}

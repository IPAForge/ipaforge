// Before a refresh: which apps need only a new profile and which must be signed and installed again. An app keeps
// working on a new profile as long as the certificate that signed it is still valid on Apple's side; IPAForge's mark
// in the app says which one that was. Without the mark (installed before marks, or by another tool) it can't tell,
// so the app is installed again, and so is an app whose App ID Apple has removed (a free team's go after 7 days),
// since no new profile can be made for it. SideStore is installed again too (over itself, its data kept) when the version on
// the device can be had: this computer's copy of it, or that version's release (stable releases are tagged by
// version). It shows the expiry of the profile inside its own files, which a new profile alone doesn't change.
// When that version can't be had (an older Nightly), it gets a new profile like any other app: a refresh never
// changes the version.

import { readMarker } from '@installer/application/installed/marker.ts'
import {
  keptKeyFor,
  readRecords
} from '@installer/application/installed/records.ts'
import { validCertificateSerials } from '@installer/application/installed/valid-certificates.ts'
import { createFlowRuntime } from '@installer/application/runtime.ts'
import { queryTeam } from '@installer/application/team.ts'
import type {
  AppMarker,
  AppOrigin,
  RefreshDecision
} from '@installer/domain/types.ts'
import { CATALOG_PAIRING_APPS } from '@installer/flows/constants.ts'
import type { InstallerDeps } from '@installer/types.ts'
import type { InstalledApp as DeviceApp } from '@ipaforge/device'

export type RefreshPlanQuery = {
  readonly udid: string
  readonly accountId: string
  readonly teamId?: string
  /** The installed apps (sideload bundle ids) to refresh. */
  readonly bundleIds: readonly string[]
}

/** SideStore, alone or inside LiveContainer, as IPAForge installed it from the catalog. */
const isSideStore = (marker: AppMarker): boolean =>
  marker.origin.kind === 'catalog' &&
  CATALOG_PAIRING_APPS[marker.origin.appId] !== undefined

/** The release of exactly this version can be downloaded (a channel with one fixed tag, Nightly, can't say). */
const canDownloadVersion = async (
  deps: InstallerDeps,
  origin: Extract<AppOrigin, { kind: 'catalog' }>,
  version: string | undefined
): Promise<boolean> => {
  if (version === undefined) return false
  try {
    const release = await deps.catalog.resolve(
      origin.appId,
      origin.channel ?? 'stable',
      undefined,
      version
    )

    return release.version.replace(/^v/, '') === version
  } catch {
    return false
  }
}

export const planRefresh = async (
  deps: InstallerDeps,
  query: RefreshPlanQuery
): Promise<RefreshDecision[]> => {
  const developer = await createFlowRuntime(deps).developer(query.accountId)
  const team = await queryTeam(deps, developer, {
    accountId: query.accountId,
    requested: query.teamId
  })
  const valid = await validCertificateSerials(deps, developer, team)
  // A new profile needs the app's App ID: a free team's are removed after 7 days.
  const appIds = new Set(
    (await developer.appIds(team)).appIds.map((appId) => appId.identifier)
  )
  const records = await readRecords(deps, query.udid)
  /** This computer kept the IPA of the version on the device (not one the app has updated from since). */
  const hasKeptCopy = async (app: DeviceApp | undefined, bundleId: string) => {
    const record = records.find((known) => known.bundleId === bundleId)
    const installed = app?.shortVersion ?? app?.version

    if (!record || record.version === undefined) return false
    if (record.version !== installed) return false

    return (
      (await deps.kept.get(
        record.keptKey ?? keptKeyFor(query.udid, bundleId)
      )) !== undefined
    )
  }
  const handle = await deps.devices.open(query.udid, { autoPair: false })

  try {
    const apps = await handle.lookupApps(query.bundleIds)
    const decide = async (bundleId: string): Promise<RefreshDecision> => {
      const app = apps.get(bundleId)
      const marker = app
        ? readMarker(app.raw, { bundleId, teamId: team.id })
        : undefined
      const serial = marker?.certificateSerial

      if (!(marker && serial))
        return { bundleId, kind: 'reinstall', reason: 'unmarked' }
      if (!valid.has(serial.toUpperCase()))
        return { bundleId, kind: 'reinstall', reason: 'certificate' }
      if (isSideStore(marker) && marker.origin.kind === 'catalog') {
        const canInstall =
          (await hasKeptCopy(app, bundleId)) ||
          (await canDownloadVersion(
            deps,
            marker.origin,
            app?.shortVersion ?? app?.version
          ))

        if (canInstall)
          return { bundleId, kind: 'reinstall', reason: 'sidestore' }
      }
      if (!appIds.has(bundleId))
        return { bundleId, kind: 'reinstall', reason: 'app-id' }

      return { bundleId, kind: 'profile' }
    }

    return await Promise.all(query.bundleIds.map(decide))
  } finally {
    await handle.close()
  }
}

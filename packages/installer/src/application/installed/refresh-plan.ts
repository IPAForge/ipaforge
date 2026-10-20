// Before a refresh: which apps need only a new profile and which must be signed and installed again. An app keeps
// working on a new profile as long as the certificate that signed it is still valid on Apple's side; IPAForge's mark
// in the app says which one that was. Without the mark (installed before marks, or by another tool) it can't tell,
// so the app is installed again. SideStore is always installed again (over itself, its data kept): it shows the
// expiry of the profile inside its own files, which a new profile alone doesn't change.

import { readMarker } from '@installer/application/installed/marker.ts'
import { validCertificateSerials } from '@installer/application/installed/valid-certificates.ts'
import { createFlowRuntime } from '@installer/application/runtime.ts'
import { queryTeam } from '@installer/application/team.ts'
import type { AppMarker, RefreshDecision } from '@installer/domain/types.ts'
import { CATALOG_PAIRING_APPS } from '@installer/flows/constants.ts'
import type { InstallerDeps } from '@installer/types.ts'

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
  const handle = await deps.devices.open(query.udid, { autoPair: false })

  try {
    const apps = await handle.lookupApps(query.bundleIds)

    return query.bundleIds.map((bundleId): RefreshDecision => {
      const app = apps.get(bundleId)
      const marker = app
        ? readMarker(app.raw, { bundleId, teamId: team.id })
        : undefined
      const serial = marker?.certificateSerial

      if (!(marker && serial))
        return { bundleId, kind: 'reinstall', reason: 'unmarked' }
      if (!valid.has(serial.toUpperCase()))
        return { bundleId, kind: 'reinstall', reason: 'certificate' }
      if (isSideStore(marker))
        return { bundleId, kind: 'reinstall', reason: 'sidestore' }

      return { bundleId, kind: 'profile' }
    })
  } finally {
    await handle.close()
  }
}

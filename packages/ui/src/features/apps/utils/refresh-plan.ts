import { compact } from '@ipaforge/kernel'
import type { RefreshPlan } from '@ui/features/apps/types.ts'
import { adoptSource } from '@ui/features/apps/utils/adopt-source.ts'
import type {
  AppSource,
  CatalogApp,
  InstalledApp,
  SourceApps
} from '@ui/services/engine/types.ts'

type Origin = NonNullable<InstalledApp['marker']>['origin']

/**
 * The install source an app's origin points to (a file can't be fetched again). The mark is read from the app, so a
 * link in it may only bring back that same app (`replaces`).
 */
const sourceOfOrigin = (
  origin: Origin,
  originalBundleId: string,
  version: string | undefined
): AppSource | undefined => {
  if (origin.kind === 'catalog')
    return compact({
      kind: 'catalog' as const,
      appId: origin.appId,
      channel: origin.channel,
      version
    })
  if (origin.kind === 'url')
    return compact({
      kind: 'url' as const,
      url: origin.url,
      replaces: originalBundleId,
      version
    })

  return undefined
}

/**
 * How Refresh installs an app again, always at the version on the device (a refresh never changes the version):
 * the copy this computer kept, when it is that version (the app may have updated itself since); else that version
 * from where its IPAForge mark says it came from; else, for an app without a mark, the catalog or a source that
 * lists that version. A marked app from a file can still get a new profile without being installed again.
 */
export const refreshPlan = (
  app: InstalledApp,
  from: string | undefined,
  catalogApps: readonly CatalogApp[],
  sources: readonly SourceApps[],
  catalogName: string
): RefreshPlan | undefined => {
  if (app.record && app.record.version === app.version) return { kind: 'kept' }
  if (app.marker) {
    const source = sourceOfOrigin(
      app.marker.origin,
      app.marker.originalBundleId,
      app.version
    )

    if (source) return { kind: 'source', source, from: from ?? catalogName }

    return app.marker.certificateSerial ? { kind: 'profile' } : undefined
  }

  return adoptSource(app, catalogApps, sources, catalogName)
}

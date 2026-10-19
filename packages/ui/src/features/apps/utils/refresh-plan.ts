import type { RefreshPlan } from '@ui/features/apps/types.ts'
import { adoptSource } from '@ui/features/apps/utils/adopt-source.ts'
import type {
  AppSource,
  CatalogApp,
  InstalledApp,
  SourceApps
} from '@ui/services/engine/types.ts'

type Origin = NonNullable<InstalledApp['marker']>['origin']

/** The install source an app's origin points to (a file can't be fetched again). */
const sourceOfOrigin = (origin: Origin): AppSource | undefined => {
  if (origin.kind === 'catalog')
    return origin.channel
      ? { kind: 'catalog', appId: origin.appId, channel: origin.channel }
      : { kind: 'catalog', appId: origin.appId }
  if (origin.kind === 'url') return { kind: 'url', url: origin.url }

  return undefined
}

/**
 * How Refresh installs an app again: the copy this computer kept; else where its IPAForge mark says it came from
 * (installed on another computer); else, for an app without a mark, the catalog or a source that lists it. A marked
 * app from a file can still get a new profile without being installed again.
 */
export const refreshPlan = (
  app: InstalledApp,
  from: string | undefined,
  catalogApps: readonly CatalogApp[],
  sources: readonly SourceApps[],
  catalogName: string
): RefreshPlan | undefined => {
  if (app.record) return { kind: 'kept' }
  if (app.marker) {
    const source = sourceOfOrigin(app.marker.origin)

    if (source) return { kind: 'source', source, from: from ?? catalogName }

    return app.marker.certificateSerial ? { kind: 'profile' } : undefined
  }

  return adoptSource(app, catalogApps, sources, catalogName)
}

import type { RefreshPlan } from '@ui/features/apps/types.ts'
import type {
  CatalogApp,
  InstalledApp,
  SourceApps
} from '@ui/services/engine/types.ts'

/** A sideloaded app's bundle id is its original one plus the team (`com.example.app.TEAMID`). */
const originalBundleId = (app: InstalledApp): string | undefined => {
  const suffix = `.${app.teamId}`

  return app.bundleId.endsWith(suffix)
    ? app.bundleId.slice(0, -suffix.length)
    : undefined
}

/**
 * Where an app IPAForge has no copy of (installed before it kept copies, or by another tool) can be installed from
 * again: the one catalog app with its original bundle id, else the newest version a source lists. Installing it
 * from there keeps its data (same bundle id, same team), and from then on IPAForge keeps it refreshed.
 */
export const adoptSource = (
  app: InstalledApp,
  catalogApps: readonly CatalogApp[],
  sources: readonly SourceApps[],
  catalogName: string
): RefreshPlan | undefined => {
  const original = originalBundleId(app)

  if (!original) return undefined

  // Two catalog apps can share a bundle id (LiveContainer, with or without SideStore): then it's not clear which.
  const inCatalog = catalogApps.filter(
    (candidate) => candidate.bundleId === original
  )
  const [only] = inCatalog

  if (inCatalog.length === 1 && only)
    return {
      kind: 'source',
      source: { kind: 'catalog', appId: only.id },
      from: catalogName
    }

  // IPAForge's own sources first: a source you added is trusted with an app's data only when nothing else lists it.
  const ordered = [...sources].sort(
    (a, b) => Number(b.builtin) - Number(a.builtin)
  )

  for (const source of ordered) {
    const listed = source.apps.find(
      (candidate) => candidate.bundleId === original
    )
    const latest = listed?.versions[0]

    if (latest)
      return {
        kind: 'source',
        source: { kind: 'url', url: latest.downloadUrl, replaces: original },
        from: source.sourceName
      }
  }

  return undefined
}

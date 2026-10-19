import type { RefreshPlan, SourceChoice } from '@ui/features/apps/types.ts'
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
 * again: the one catalog app with its original bundle id, else the newest version in a source that lists it, with
 * the others to pick from. Installing it from there keeps its data (same bundle id, same team), and from then on
 * IPAForge keeps it refreshed.
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

  // Every source listing it, with its newest version: first the ones that also list the version on the device (the
  // app most likely came from one of those), then IPAForge's own sources, then the ones the user added.
  const choices: SourceChoice[] = sources
    .flatMap((source) => {
      const listed = source.apps.find(
        (candidate) => candidate.bundleId === original
      )
      const latest = listed?.versions[0]

      if (!(listed && latest)) return []

      return [
        {
          choice: {
            source: {
              kind: 'url' as const,
              url: latest.downloadUrl,
              replaces: original
            },
            from: source.sourceName,
            version: latest.version
          },
          listsInstalled: listed.versions.some(
            (version) => version.version === app.version
          ),
          builtin: source.builtin
        }
      ]
    })
    .sort(
      (a, b) =>
        Number(b.listsInstalled) - Number(a.listsInstalled) ||
        Number(b.builtin) - Number(a.builtin)
    )
    .map(({ choice }) => choice)
  const [first] = choices

  if (!first) return undefined

  return {
    kind: 'source',
    source: first.source,
    from: first.from,
    ...(choices.length > 1 ? { choices } : {})
  }
}

import { compact } from '@ipaforge/kernel'
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
 * again, at the version on the device (a refresh never changes the version): the one catalog app with its original
 * bundle id, else a source that lists that version, IPAForge's own sources first, with the others to pick from.
 * Installing it from there keeps its data (same bundle id, same team), and from then on IPAForge keeps it refreshed.
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
      source: compact({
        kind: 'catalog' as const,
        appId: only.id,
        version: app.version
      }),
      from: catalogName
    }

  const installed = app.version

  // Without the version on the device, no source can be told to have it.
  if (installed === undefined) return undefined

  // Every source listing the version on the device, IPAForge's own sources first.
  const choices: SourceChoice[] = sources
    .flatMap((source) => {
      const match = source.apps
        .find((candidate) => candidate.bundleId === original)
        ?.versions.find((version) => version.version === installed)

      if (!match) return []

      return [
        {
          choice: {
            source: {
              kind: 'url' as const,
              url: match.downloadUrl,
              replaces: original,
              version: installed
            },
            from: source.sourceName,
            version: installed
          },
          builtin: source.builtin
        }
      ]
    })
    .sort((a, b) => Number(b.builtin) - Number(a.builtin))
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

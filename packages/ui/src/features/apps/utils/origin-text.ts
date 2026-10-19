import type { InstalledApp, SourceApps } from '@ui/services/engine/types.ts'

/**
 * Where an installed app came from, in words: the catalog, the source that lists its download link, the link's
 * host, or the file's name.
 */
export const originText = (
  app: InstalledApp,
  sources: readonly SourceApps[],
  catalogName: string
): string | undefined => {
  const origin = app.record?.origin ?? app.marker?.origin

  if (!origin) return undefined
  if (origin.kind === 'catalog') return catalogName
  if (origin.kind === 'file') return origin.name

  const listed = sources.find((source) =>
    source.apps.some((candidate) =>
      candidate.versions.some((version) => version.downloadUrl === origin.url)
    )
  )

  if (listed) return listed.sourceName
  try {
    return new URL(origin.url).host
  } catch {
    return origin.url
  }
}

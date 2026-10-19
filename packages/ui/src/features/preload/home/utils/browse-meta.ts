import type { BrowseEntry } from '@ui/features/preload/home/types.ts'

/** The card's third line: a source app's latest version and size, or, for the catalog, that releases are checked. */
export const browseMeta = (
  entry: BrowseEntry,
  say: {
    catalogLine: string
    version: (version: string, size: string) => string
  },
  fileSize: (bytes: number) => string
): string => {
  const latest = entry.sourceApp?.versions[0]

  if (!latest) return say.catalogLine
  if (!latest.size) return latest.version

  return say.version(latest.version, fileSize(latest.size))
}

import type { PreloadItem } from '@ui/state/preload/types.ts'

/** Where an app in the list comes from: the catalog, an app source, its link, or its file name and size. */
export const sourceLine = (
  item: PreloadItem,
  from: { catalog: string; source: (name: string) => string },
  fileSize: (bytes: number) => string
): string => {
  if (item.source?.kind === 'catalog') return from.catalog
  if (item.origin) return from.source(item.origin)
  if (item.source?.kind === 'url') return item.source.url
  return [item.label, item.size ? fileSize(item.size) : undefined]
    .filter(Boolean)
    .join(' · ')
}

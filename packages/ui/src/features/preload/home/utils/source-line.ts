import type { PreloadItem } from '@ui/state/preload/types.ts'

/** Where an app in the list comes from: the catalog, its link, or its file name and size. */
export const sourceLine = (
  item: PreloadItem,
  fromCatalog: string,
  fileSize: (bytes: number) => string
): string => {
  if (item.source?.kind === 'catalog') return fromCatalog
  if (item.source?.kind === 'url') return item.source.url
  return [item.label, item.size ? fileSize(item.size) : undefined]
    .filter(Boolean)
    .join(' · ')
}

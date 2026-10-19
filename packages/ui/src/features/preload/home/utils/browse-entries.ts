import { CATALOG_SOURCE_ID } from '@ui/features/preload/home/constants.ts'
import type {
  BrowseEntry,
  BrowseInput
} from '@ui/features/preload/home/types.ts'

const catalogEntries = (input: BrowseInput): BrowseEntry[] =>
  input.catalogName === undefined
    ? []
    : input.catalogApps.map((app) => ({
        key: `${CATALOG_SOURCE_ID}:${app.id}`,
        name: app.name,
        bundleId: app.bundleId,
        sourceId: CATALOG_SOURCE_ID,
        sourceName: input.catalogName ?? '',
        builtin: true,
        also: [],
        catalogApp: app
      }))

const sourceEntries = (input: BrowseInput): BrowseEntry[] =>
  input.sources.flatMap((source) =>
    source.apps.map((app) => ({
      key: `${source.sourceId}:${app.bundleId}`,
      name: app.name,
      bundleId: app.bundleId,
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      builtin: source.builtin,
      also: [],
      sourceApp: app
    }))
  )

/** One card per app: a later source's copy of an app is folded into the first one, which names it in `also`. */
const listOnce = (entries: readonly BrowseEntry[]): BrowseEntry[] => {
  const first = new Map<string, BrowseEntry>()
  const out: BrowseEntry[] = []

  for (const entry of entries) {
    const shown = first.get(entry.bundleId)

    if (shown && shown.sourceId !== entry.sourceId) {
      const merged = { ...shown, also: [...shown.also, entry.sourceName] }

      first.set(entry.bundleId, merged)
      out[out.indexOf(shown)] = merged
      continue
    }
    if (!shown) first.set(entry.bundleId, entry)
    out.push(entry)
  }
  return out
}

const matches = (entry: BrowseEntry, query: string) => {
  const words = [
    entry.name,
    entry.sourceApp?.developer,
    entry.sourceApp?.subtitle
  ]

  return words.some((word) => word?.toLowerCase().includes(query))
}

/**
 * Browse apps: the catalog first, then each source in order, filtered to one source when asked and searched by
 * name, developer and subtitle. The same app in two sources shows once, from the first (trusted sources come first).
 */
export const browseEntries = (input: BrowseInput): BrowseEntry[] => {
  const all = [...catalogEntries(input), ...sourceEntries(input)].filter(
    (entry) => input.filter === undefined || entry.sourceId === input.filter
  )
  const query = input.query.trim().toLowerCase()
  const once = listOnce(all)

  return query ? once.filter((entry) => matches(entry, query)) : once
}

// The sources IPAForge ships with, trusted: its own catalog and SideStore's official source. They can be turned off,
// not removed. Ids are stable: they're saved with the user's choices.
import type { SourceEntry } from '@catalog/domain/types.ts'

export const CATALOG_SOURCE_ID = 'ipaforge'

export const SIDESTORE_SOURCE_ID = 'sidestore'

export const SIDESTORE_SOURCE_URL = 'https://apps.sidestore.io'

/** Built-in sources in display order; `url` of the catalog is filled in from the config's manifest URL. */
export const builtinSources = (manifestUrl: string): readonly SourceEntry[] => [
  {
    id: CATALOG_SOURCE_ID,
    kind: 'catalog',
    url: manifestUrl,
    builtin: true,
    enabled: true
  },
  {
    id: SIDESTORE_SOURCE_ID,
    kind: 'altstore',
    url: SIDESTORE_SOURCE_URL,
    builtin: true,
    enabled: true
  }
]

import type { TranslationKey } from '@ui/i18n/setup/types.ts'

/** What each catalog app is for, by catalog id; an app the catalog adds later shows without a description. */
export const catalogDescriptionKeys: Readonly<Record<string, TranslationKey>> =
  {
    sidestore: 'preload.catalog.sidestore',
    'livecontainer-sidestore': 'preload.catalog.livecontainerSidestore',
    livecontainer: 'preload.catalog.livecontainer',
    stikdebug: 'preload.catalog.stikdebug',
    feather: 'preload.catalog.feather'
  }

/** Catalog apps that get this computer's pairing file and the signing certificate once installed. */
export const pairingCatalogApps: ReadonlySet<string> = new Set([
  'sidestore',
  'livecontainer-sidestore'
])

/** The catalog app the card marks as recommended. */
export const RECOMMENDED_CATALOG_APP = 'sidestore'

/** The id of IPAForge's own catalog among the sources. */
export const CATALOG_SOURCE_ID = 'ipaforge'

/** The source filter's value for "All sources". */
export const ALL_SOURCES = 'all'

/** How many app names Add source shows from a source before adding it. */
export const PREVIEW_APPS = 4

/** Preload's tab keys (React Aria keys, not DOM ids). */
export const PreloadTabKey = { apps: 'apps', sources: 'sources' } as const

/** SideStore itself (alone, or inside LiveContainer): no Install with SideStore, since SideStore can't install itself. */
export const SIDESTORE_CATALOG_APPS: ReadonlySet<string> = new Set([
  'sidestore',
  'livecontainer-sidestore'
])

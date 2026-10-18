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

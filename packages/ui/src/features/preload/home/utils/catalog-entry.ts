import type { BrowseEntry } from '@ui/features/preload/home/types.ts'
import type { CatalogRelease } from '@ui/services/engine/types.ts'

/**
 * A catalog app as the details show a source app: its releases (newest channel first) as the versions to pick,
 * each with its .ipa link, size, date and the iOS the app needs.
 */
export const catalogEntry = (
  entry: BrowseEntry,
  releases: readonly CatalogRelease[],
  description: string | undefined,
  date: (value: Date) => string
): BrowseEntry => ({
  ...entry,
  sourceApp: {
    bundleId: entry.bundleId,
    name: entry.name,
    ...(description ? { description } : {}),
    versions: releases.map((release) => ({
      version: release.version,
      downloadUrl: release.downloadUrl,
      ...(release.size === undefined ? {} : { size: release.size }),
      ...(release.publishedAt ? { date: date(release.publishedAt) } : {}),
      ...(entry.catalogApp?.minimumIos
        ? { minOsVersion: entry.catalogApp.minimumIos }
        : {})
    }))
  }
})

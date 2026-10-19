import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  ALL_SOURCES,
  CATALOG_SOURCE_ID
} from '@ui/features/preload/home/constants.ts'
import { browseEntries } from '@ui/features/preload/home/utils/browse-entries.ts'
import { useCatalogApps } from '@ui/hooks/queries/use-catalog-apps.ts'
import { useSourceApps } from '@ui/hooks/queries/use-source-apps.ts'
import { useSources } from '@ui/hooks/queries/use-sources.ts'

/** Browse apps: the apps of every source that's on, a source filter and a search, and the sources that failed. */
export const useBrowse = () => {
  const { t } = useTranslation()
  const [filter, setFilter] = useState(ALL_SOURCES)
  const [query, setQuery] = useState('')
  const sources = useSources()
  const sourceApps = useSourceApps()
  const catalogApps = useCatalogApps().data ?? []
  const shown = (sources.data ?? []).filter((source) => source.enabled)
  const isCatalogOn = shown.some((source) => source.id === CATALOG_SOURCE_ID)
  // A source turned off while picked in the filter leaves "All sources".
  const picked = shown.some((source) => source.id === filter)
    ? filter
    : ALL_SOURCES
  const entries = browseEntries({
    catalogApps,
    catalogName: isCatalogOn ? t('preload.sources.catalogName') : undefined,
    sources: sourceApps.data ?? [],
    filter: picked === ALL_SOURCES ? undefined : picked,
    query
  })

  return {
    entries,
    shown,
    filter: picked,
    setFilter,
    query,
    setQuery,
    isLoading: sources.isPending || sourceApps.isPending,
    failed: shown.filter((source) => source.error !== undefined)
  }
}

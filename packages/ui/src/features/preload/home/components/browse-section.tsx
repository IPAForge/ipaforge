import { Spinner } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BrowseCard } from '@ui/features/preload/home/components/browse-card.tsx'
import { BrowseToolbar } from '@ui/features/preload/home/components/browse-toolbar.tsx'
import { NotRefreshedNotice } from '@ui/features/preload/home/components/not-refreshed-notice.tsx'
import { SourceAppDialog } from '@ui/features/preload/home/components/source-app-dialog.tsx'
import { useBrowse } from '@ui/features/preload/home/hooks/use-browse.ts'
import { useSourceName } from '@ui/features/preload/home/hooks/use-source-name.ts'
import type { BrowseEntry } from '@ui/features/preload/home/types.ts'
import type { SourceAppVersion } from '@ui/services/engine/types.ts'
import type { PreloadItem } from '@ui/state/preload/types.ts'

type BrowseSectionProps = {
  items: readonly PreloadItem[]
  onAdd: (entry: BrowseEntry, version?: SourceAppVersion) => void
  onManage: () => void
}

/** Browse apps: every source's apps, one card each, with a source filter, search and each app's details. */
export const BrowseSection = ({
  items,
  onAdd,
  onManage
}: BrowseSectionProps) => {
  const { t } = useTranslation()
  const browse = useBrowse()
  const sourceName = useSourceName()
  const [details, setDetails] = useState<BrowseEntry>()
  const added = new Set(
    items.flatMap((item) => (item.appId ? [item.appId] : []))
  )
  const isAdded = (entry: BrowseEntry) =>
    added.has(entry.catalogApp?.id ?? entry.bundleId)
  const onCloseDetails = () => setDetails(undefined)
  const onAddEntry = (entry: BrowseEntry) => onAdd(entry)

  const body = () => {
    if (browse.isLoading)
      return (
        <p className="flex items-center gap-2 text-muted text-sm">
          <Spinner size="sm" />
          {t('preload.browse.loading')}
        </p>
      )
    if (browse.shown.length === 0)
      return (
        <p className="rounded-xl border border-border border-dashed p-6 text-center text-muted text-sm">
          {t('preload.browse.allOff')}
        </p>
      )
    if (browse.entries.length === 0)
      return (
        <p className="rounded-xl border border-border border-dashed p-6 text-center text-muted text-sm">
          {t('preload.browse.noMatch', { query: browse.query.trim() })}
        </p>
      )
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {browse.entries.map((entry) => (
          <BrowseCard
            key={entry.key}
            entry={entry}
            isAdded={isAdded(entry)}
            onAdd={onAddEntry}
            onDetails={setDetails}
          />
        ))}
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{t('preload.browse.title')}</h2>
        <span className="text-muted text-sm">
          {t('preload.browse.count', {
            apps: browse.entries.length,
            sources: browse.shown.length
          })}
        </span>
      </div>
      <BrowseToolbar
        sources={browse.shown}
        filter={browse.filter}
        query={browse.query}
        sourceName={sourceName}
        onFilter={browse.setFilter}
        onQuery={browse.setQuery}
        onManage={onManage}
      />
      {browse.failed.map((source) => (
        <NotRefreshedNotice
          key={source.id}
          source={source}
          name={sourceName(source)}
        />
      ))}
      {body()}
      {details ? (
        <SourceAppDialog
          entry={details}
          isAdded={isAdded(details)}
          onAdd={onAdd}
          onClose={onCloseDetails}
        />
      ) : null}
    </section>
  )
}

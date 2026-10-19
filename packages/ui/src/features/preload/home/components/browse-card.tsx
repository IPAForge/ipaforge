import { Button, Chip } from '@heroui/react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AppIcon } from '@ui/components/app-icon.tsx'
import {
  catalogDescriptionKeys,
  RECOMMENDED_CATALOG_APP
} from '@ui/features/preload/home/constants.ts'
import type { BrowseEntry } from '@ui/features/preload/home/types.ts'
import { browseMeta } from '@ui/features/preload/home/utils/browse-meta.ts'
import { useFormat } from '@ui/hooks/use-format.ts'

type BrowseCardProps = {
  entry: BrowseEntry
  isAdded: boolean
  onAdd: (entry: BrowseEntry) => void
  onDetails: (entry: BrowseEntry) => void
}

/**
 * An app in Browse apps, in the same order on every card: the icon beside its name and developer (and Recommended),
 * what it's for in two lines (the details have the rest), then a footer with its version and size and the source it
 * comes from (amber for a source the user added; "+1" when others have it too, named on hover), beside Add. A source
 * app's name opens its details.
 */
export const BrowseCard = ({
  entry,
  isAdded,
  onAdd,
  onDetails
}: BrowseCardProps) => {
  const { t } = useTranslation()
  const { fileSize, list } = useFormat()
  const catalogId = entry.catalogApp?.id
  const descriptionKey = catalogId
    ? catalogDescriptionKeys[catalogId]
    : undefined
  const description = descriptionKey
    ? t(descriptionKey)
    : (entry.sourceApp?.subtitle ?? entry.sourceApp?.description)
  const meta = browseMeta(
    entry,
    {
      catalogLine: t('preload.browse.catalogLine'),
      version: (version, size) => t('preload.browse.version', { version, size })
    },
    fileSize
  )
  const also = entry.also.length
  const allSources = also
    ? t('preload.browse.from', {
        name: entry.sourceName,
        others: list(entry.also)
      })
    : entry.sourceName

  const onAddPress = () => onAdd(entry)
  const onDetailsPress = () => onDetails(entry)

  return (
    <article
      aria-label={entry.name}
      className="flex h-full min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AppIcon name={entry.name} tint={entry.sourceApp?.tint} />
        <div className="flex min-w-0 flex-col gap-0.5">
          {entry.sourceApp ? (
            <button
              type="button"
              className="line-clamp-2 cursor-pointer text-start font-semibold hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-focus"
              onClick={onDetailsPress}
              aria-label={t('preload.browse.details', { name: entry.name })}
            >
              {entry.name}
            </button>
          ) : (
            <span className="line-clamp-2 font-semibold">{entry.name}</span>
          )}
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted text-xs">
            {entry.sourceApp?.developer ? (
              <span className="truncate">{entry.sourceApp.developer}</span>
            ) : null}
            {catalogId === RECOMMENDED_CATALOG_APP ? (
              <Chip size="sm" color="accent">
                {t('preload.catalog.recommended')}
              </Chip>
            ) : null}
          </span>
        </div>
      </div>
      <p className="line-clamp-2 min-h-[2lh] text-muted text-sm">
        {description}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3 border-border border-t pt-3">
        <div className="flex min-w-0 flex-col text-xs">
          <span className="tabular-nums">{meta}</span>
          <span
            className={
              entry.builtin ? 'text-muted' : 'text-warning-soft-foreground'
            }
            title={allSources}
          >
            {entry.sourceName}
            {also ? ` · +${also}` : null}
          </span>
        </div>
        {isAdded ? (
          <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-sm text-success-soft-foreground">
            <Check aria-hidden="true" className="size-4" />
            {t('preload.catalog.added')}
          </span>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0"
            onPress={onAddPress}
          >
            {t('preload.catalog.add')}
          </Button>
        )}
      </div>
    </article>
  )
}

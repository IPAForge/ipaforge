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
 * An app in Browse apps, the same layout for every app: the icon beside its name, its latest version and the source
 * it comes from (in full, and in the warning colour for a source the user added), what it's for (three lines at
 * most; the details have the rest), then Add at the foot.
 * A source app's name opens its details.
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
  const where = entry.also.length
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
      className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-3"
    >
      <div className="flex items-start gap-3">
        <AppIcon name={entry.name} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
            {entry.sourceApp ? (
              <button
                type="button"
                className="min-w-0 cursor-pointer text-start hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-focus"
                onClick={onDetailsPress}
                aria-label={t('preload.browse.details', { name: entry.name })}
              >
                {entry.name}
              </button>
            ) : (
              entry.name
            )}
            {catalogId === RECOMMENDED_CATALOG_APP ? (
              <Chip size="sm">{t('preload.catalog.recommended')}</Chip>
            ) : null}
          </span>
          <span className="text-muted text-xs">{meta}</span>
          <span
            className={`text-xs ${entry.builtin ? 'text-muted' : 'text-warning-soft-foreground'}`}
          >
            {where}
          </span>
        </div>
      </div>
      {description ? (
        <p className="line-clamp-3 text-muted text-xs">{description}</p>
      ) : null}
      <div className="mt-auto pt-1">
        {isAdded ? (
          <span className="inline-flex h-7 items-center gap-1 text-accent text-xs">
            <Check aria-hidden="true" className="size-3.5" />
            {t('preload.catalog.added')}
          </span>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 min-w-0 px-3 text-xs"
            onPress={onAddPress}
          >
            {t('preload.catalog.add')}
          </Button>
        )}
      </div>
    </article>
  )
}

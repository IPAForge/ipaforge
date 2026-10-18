import { Button, Chip } from '@heroui/react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AppIcon } from '@ui/components/app-icon.tsx'
import {
  catalogDescriptionKeys,
  RECOMMENDED_CATALOG_APP
} from '@ui/features/preload/home/constants.ts'
import type { CatalogApp } from '@ui/services/engine/types.ts'

type CatalogCardProps = {
  app: CatalogApp
  isAdded: boolean
  onAdd: (app: CatalogApp) => void
}

/** A catalog app: what it is for, and Add (or that it is in the list already). */
export const CatalogCard = ({ app, isAdded, onAdd }: CatalogCardProps) => {
  const { t } = useTranslation()
  const descriptionKey = catalogDescriptionKeys[app.id]
  const onPress = () => onAdd(app)

  return (
    <article
      aria-label={app.name}
      className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-xl border border-border bg-surface p-3"
    >
      <AppIcon name={app.name} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          {app.name}
          {app.id === RECOMMENDED_CATALOG_APP ? (
            <Chip size="sm">{t('preload.catalog.recommended')}</Chip>
          ) : null}
        </span>
        {descriptionKey ? (
          <span className="text-muted text-xs">{t(descriptionKey)}</span>
        ) : null}
      </div>
      <div className="col-start-2 pt-1">
        {isAdded ? (
          <span className="inline-flex items-center gap-1 text-accent text-sm">
            <Check aria-hidden="true" className="size-4" />
            {t('preload.catalog.added')}
          </span>
        ) : (
          <Button size="sm" variant="secondary" onPress={onPress}>
            {t('preload.catalog.add')}
          </Button>
        )}
      </div>
    </article>
  )
}

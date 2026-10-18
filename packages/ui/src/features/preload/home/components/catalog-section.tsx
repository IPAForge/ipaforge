import { useTranslation } from 'react-i18next'

import { CatalogCard } from '@ui/features/preload/home/components/catalog-card.tsx'
import { useCatalogApps } from '@ui/hooks/queries/use-catalog-apps.ts'
import type { CatalogApp } from '@ui/services/engine/types.ts'
import type { PreloadItem } from '@ui/state/preload/types.ts'

type CatalogSectionProps = {
  items: readonly PreloadItem[]
  onAdd: (app: CatalogApp) => void
}

/** The catalog's apps, each added with one press; their releases come from GitHub, checked against a checksum. */
export const CatalogSection = ({ items, onAdd }: CatalogSectionProps) => {
  const { t } = useTranslation()
  const apps = useCatalogApps().data ?? []
  const added = new Set(
    items.flatMap((item) =>
      item.source?.kind === 'catalog' ? [item.source.appId] : []
    )
  )

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{t('preload.catalog.title')}</h2>
        <span className="text-muted text-sm">{t('preload.catalog.hint')}</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {apps.map((app) => (
          <CatalogCard
            key={app.id}
            app={app}
            isAdded={added.has(app.id)}
            onAdd={onAdd}
          />
        ))}
      </div>
    </section>
  )
}

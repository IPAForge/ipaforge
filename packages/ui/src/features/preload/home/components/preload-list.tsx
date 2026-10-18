import { useTranslation } from 'react-i18next'

import { PreloadRow } from '@ui/features/preload/home/components/preload-row.tsx'
import type { PreloadRow as Row } from '@ui/features/preload/home/types.ts'

type PreloadListProps = {
  rows: readonly Row[]
  onRemove: (id: string) => void
}

/** The apps to install, in the order they were added. */
export const PreloadList = ({ rows, onRemove }: PreloadListProps) => {
  const { t } = useTranslation()

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{t('preload.list.title')}</h2>
        {rows.length > 0 ? (
          <span className="text-muted text-sm">
            {t('preload.list.count', { count: rows.length })}
          </span>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-border border-dashed p-6 text-center text-muted text-sm">
          {t('preload.list.empty')}
        </p>
      ) : (
        <ul
          aria-label={t('preload.list.title')}
          className="flex flex-col gap-2"
        >
          {rows.map((row) => (
            <PreloadRow key={row.item.id} row={row} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </section>
  )
}

import { Button } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AddSourceDialog } from '@ui/features/preload/home/components/add-source-dialog.tsx'
import { RemoveSourceDialog } from '@ui/features/preload/home/components/remove-source-dialog.tsx'
import { SourceRow } from '@ui/features/preload/home/components/source-row.tsx'
import { useSourceName } from '@ui/features/preload/home/hooks/use-source-name.ts'
import { useSourceActions } from '@ui/hooks/queries/use-source-actions.ts'
import { useSources } from '@ui/hooks/queries/use-sources.ts'
import type { SourceInfo } from '@ui/services/engine/types.ts'

/** The Sources tab: every source with On/Off, Refresh and Remove, Refresh all, and Add source. */
export const SourcesPanel = () => {
  const { t } = useTranslation()
  const sources = useSources().data ?? []
  const sourceName = useSourceName()
  const { refresh } = useSourceActions()
  const [isAdding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<SourceInfo>()
  const onAdd = () => setAdding(true)
  const onCloseAdd = () => setAdding(false)
  const onCloseRemove = () => setRemoving(undefined)
  const onRefreshAll = () => refresh.mutate(undefined)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 basis-64 text-muted text-sm">
          {t('preload.sources.description')}
        </p>
        <div className="flex gap-2">
          <Button
            variant="tertiary"
            onPress={onRefreshAll}
            isPending={refresh.isPending}
          >
            {t('preload.sources.refreshAll')}
          </Button>
          <Button onPress={onAdd}>{t('preload.sources.add')}</Button>
        </div>
      </div>
      <ul
        aria-label={t('preload.sources.list')}
        className="flex flex-col gap-2"
      >
        {sources.map((source) => (
          <SourceRow
            key={source.id}
            source={source}
            name={sourceName(source)}
            onRemove={setRemoving}
          />
        ))}
      </ul>
      <p className="text-muted text-xs">{t('preload.sources.note')}</p>
      {isAdding ? <AddSourceDialog onClose={onCloseAdd} /> : null}
      {removing ? (
        <RemoveSourceDialog
          source={removing}
          name={sourceName(removing)}
          onClose={onCloseRemove}
        />
      ) : null}
    </section>
  )
}

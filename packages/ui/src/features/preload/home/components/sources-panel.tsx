import { Button } from '@heroui/react'
import { QrCode as QrCodeIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AddSourceDialog } from '@ui/features/preload/home/components/add-source-dialog.tsx'
import { RemoveSourceDialog } from '@ui/features/preload/home/components/remove-source-dialog.tsx'
import { SourceRow } from '@ui/features/preload/home/components/source-row.tsx'
import { useSourceName } from '@ui/features/preload/home/hooks/use-source-name.ts'
import { AddToSideStoreDialog } from '@ui/features/preload/sidestore/components/add-to-sidestore-dialog.tsx'
import { isSideStoreSource } from '@ui/features/preload/sidestore/utils/sidestore-sources.ts'
import { useSourceActions } from '@ui/hooks/queries/use-source-actions.ts'
import { useSources } from '@ui/hooks/queries/use-sources.ts'
import type { SourceInfo } from '@ui/services/engine/types.ts'

/**
 * The Sources tab: what it's for, then Add source, Refresh all and Add all to SideStore; every source with On/Off,
 * Refresh, Add to SideStore (the ones you added) and Remove.
 */
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
  const [sharing, setSharing] = useState<readonly SourceInfo[]>()
  const toSideStore = sources.filter(isSideStoreSource)
  const onAddToSideStore = (source: SourceInfo) => setSharing([source])
  const onAddAllToSideStore = () => setSharing(toSideStore)
  const onCloseSharing = () => setSharing(undefined)

  return (
    <section className="flex flex-col gap-3">
      <p className="text-muted text-sm">{t('preload.sources.description')}</p>
      <div className="flex flex-wrap gap-2">
        <Button onPress={onAdd}>{t('preload.sources.add')}</Button>
        <Button
          variant="tertiary"
          onPress={onRefreshAll}
          isPending={refresh.isPending}
        >
          {t('preload.sources.refreshAll')}
        </Button>
        {toSideStore.length > 0 ? (
          <Button variant="tertiary" onPress={onAddAllToSideStore}>
            <QrCodeIcon aria-hidden="true" className="size-4" />
            {t('sidestore.addAll')}
          </Button>
        ) : null}
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
            onAddToSideStore={onAddToSideStore}
          />
        ))}
      </ul>
      <p className="text-muted text-xs">{t('preload.sources.note')}</p>
      {isAdding ? <AddSourceDialog onClose={onCloseAdd} /> : null}
      {sharing ? (
        <AddToSideStoreDialog
          sources={sharing}
          nameOf={sourceName}
          onClose={onCloseSharing}
        />
      ) : null}
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

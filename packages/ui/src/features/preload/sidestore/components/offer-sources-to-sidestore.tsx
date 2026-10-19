import { Button } from '@heroui/react'
import { QrCode } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSourceName } from '@ui/features/preload/home/hooks/use-source-name.ts'
import { AddToSideStoreDialog } from '@ui/features/preload/sidestore/components/add-to-sidestore-dialog.tsx'
import { isSideStoreSource } from '@ui/features/preload/sidestore/utils/sidestore-sources.ts'
import { useSources } from '@ui/hooks/queries/use-sources.ts'

/** After SideStore is installed: the sources you added here can go to SideStore too, one scan each. */
export const OfferSourcesToSideStore = () => {
  const { t } = useTranslation()
  const sources = (useSources().data ?? []).filter(isSideStoreSource)
  const sourceName = useSourceName()
  const [isOpen, setOpen] = useState(false)
  const onOpen = () => setOpen(true)
  const onClose = () => setOpen(false)

  if (sources.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm">
        {t('sidestore.offer', { count: sources.length })}
      </span>
      <Button size="sm" variant="secondary" onPress={onOpen}>
        <QrCode aria-hidden="true" className="size-4" />
        {t('sidestore.addAll')}
      </Button>
      {isOpen ? (
        <AddToSideStoreDialog
          sources={sources}
          nameOf={sourceName}
          onClose={onClose}
        />
      ) : null}
    </div>
  )
}

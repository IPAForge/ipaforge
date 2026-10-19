import { Button, Modal, Spinner } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { SourceAppDialog } from '@ui/features/preload/home/components/source-app-dialog.tsx'
import {
  catalogDescriptionKeys,
  SIDESTORE_CATALOG_APPS
} from '@ui/features/preload/home/constants.ts'
import type { BrowseEntry } from '@ui/features/preload/home/types.ts'
import { catalogEntry } from '@ui/features/preload/home/utils/catalog-entry.ts'
import { useCatalogReleases } from '@ui/hooks/queries/use-catalog-releases.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { Channel, SourceAppVersion } from '@ui/services/engine/types.ts'

type CatalogAppDialogProps = {
  entry: BrowseEntry
  isAdded: boolean
  onAdd: (entry: BrowseEntry, version: undefined, channel: Channel) => void
  onClose: () => void
}

/**
 * A catalog app's details: its latest release on each channel (looked up on GitHub when they open), shown like a
 * source app's, so a channel can be picked, added, or installed with SideStore.
 */
export const CatalogAppDialog = ({
  entry,
  isAdded,
  onAdd,
  onClose
}: CatalogAppDialogProps) => {
  const { t } = useTranslation()
  const { date } = useFormat()
  const appId = entry.catalogApp?.id ?? ''
  const releases = useCatalogReleases(appId)
  const descriptionKey = catalogDescriptionKeys[appId]
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose()
  }

  if (releases.data && releases.data.length > 0) {
    const data = releases.data
    const onAddVersion = (_entry: BrowseEntry, version: SourceAppVersion) => {
      const release = data.find(
        (candidate) => candidate.version === version.version
      )

      onAdd(entry, undefined, release?.channel ?? 'stable')
    }

    return (
      <SourceAppDialog
        entry={catalogEntry(
          entry,
          data,
          descriptionKey ? t(descriptionKey) : undefined,
          date
        )}
        isAdded={isAdded}
        onAdd={onAddVersion}
        onClose={onClose}
        canInstallWithSideStore={!SIDESTORE_CATALOG_APPS.has(appId)}
      />
    )
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{entry.name}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {releases.isPending ? (
                <p className="flex items-center gap-2 text-muted text-sm">
                  <Spinner size="sm" />
                  {t('preload.detail.loadingReleases')}
                </p>
              ) : (
                <p className="text-sm">{t('preload.detail.noReleases')}</p>
              )}
            </Modal.Body>
            <Modal.Footer className="flex justify-end">
              <Button variant="tertiary" onPress={onClose}>
                {t('preload.detail.close')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

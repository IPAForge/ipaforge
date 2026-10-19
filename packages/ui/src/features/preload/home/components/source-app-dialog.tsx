import { Modal } from '@heroui/react'
import { type Key, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AppIcon } from '@ui/components/app-icon.tsx'
import { SourceAppDetails } from '@ui/features/preload/home/components/source-app-details.tsx'
import type { BrowseEntry } from '@ui/features/preload/home/types.ts'
import { InstallWithSideStore } from '@ui/features/preload/sidestore/components/install-with-sidestore.tsx'
import type { SourceAppVersion } from '@ui/services/engine/types.ts'

type SourceAppDialogProps = {
  entry: BrowseEntry
  isAdded: boolean
  onAdd: (entry: BrowseEntry, version: SourceAppVersion) => void
  onClose: () => void
  /** Install with SideStore is offered; not for SideStore itself. */
  canInstallWithSideStore?: boolean
}

/**
 * An app source's app: what it is, which version (the latest, or an older one), its size, iOS and source; and
 * Install with SideStore, which shows the code SideStore installs that version from, on the iPhone itself.
 */
export const SourceAppDialog = ({
  entry,
  isAdded,
  onAdd,
  onClose,
  canInstallWithSideStore = true
}: SourceAppDialogProps) => {
  const { t } = useTranslation()
  const versions = entry.sourceApp?.versions ?? []
  const [picked, setPicked] = useState(versions[0]?.version)
  const version =
    versions.find((candidate) => candidate.version === picked) ?? versions[0]
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose()
  }
  const onVersion = (key: Key | null) => setPicked(String(key))
  const [isSharing, setSharing] = useState(false)
  const onShare = () => setSharing(true)
  const onBack = () => setSharing(false)
  const onAddPress = () => {
    if (version) onAdd(entry, version)
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog>
            <Modal.Header className="flex flex-row items-center gap-3">
              <AppIcon name={entry.name} tint={entry.sourceApp?.tint} />
              <div className="flex min-w-0 flex-col">
                <Modal.Heading>
                  {isSharing
                    ? t('sidestore.installTitle', { name: entry.name })
                    : entry.name}
                </Modal.Heading>
                {entry.sourceApp?.developer ? (
                  <span className="text-muted text-sm">
                    {entry.sourceApp.developer}
                  </span>
                ) : null}
              </div>
            </Modal.Header>
            {isSharing && version ? (
              <InstallWithSideStore
                name={entry.name}
                version={version}
                onBack={onBack}
                onClose={onClose}
              />
            ) : (
              <SourceAppDetails
                entry={entry}
                versions={versions}
                version={version}
                isAdded={isAdded}
                onVersion={onVersion}
                canShare={canInstallWithSideStore}
                onShare={onShare}
                onAdd={onAddPress}
                onClose={onClose}
              />
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

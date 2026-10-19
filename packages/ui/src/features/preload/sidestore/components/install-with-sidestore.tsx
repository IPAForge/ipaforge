import { Button, Modal } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { useDeviceView } from '@ui/features/devices/hooks/use-device-view.ts'
import { SideStoreLinkPanel } from '@ui/features/preload/sidestore/components/sidestore-link-panel.tsx'
import { sideStoreInstallLink } from '@ui/features/preload/sidestore/utils/sidestore-links.ts'
import { useDeviceInUse } from '@ui/hooks/use-selection.ts'
import type { SourceAppVersion } from '@ui/services/engine/types.ts'

type InstallWithSideStoreProps = {
  name: string
  version: SourceAppVersion
  onBack: () => void
  onClose: () => void
}

/** Inside an app's details: the code SideStore installs this version from, on the iPhone itself; Back and Done. */
export const InstallWithSideStore = ({
  name,
  version,
  onBack,
  onClose
}: InstallWithSideStoreProps) => {
  const { t } = useTranslation()
  const inUse = useDeviceInUse()
  const device = useDeviceView(inUse?.udid, inUse?.device).name

  return (
    <>
      <Modal.Body className="flex flex-col gap-4">
        <SideStoreLinkPanel
          link={sideStoreInstallLink(version.downloadUrl)}
          askKey="sidestore.steps.install"
          body={t('sidestore.installBody', { name, version: version.version })}
          device={device}
        />
      </Modal.Body>
      <Modal.Footer className="flex items-center justify-end gap-2">
        <Button variant="tertiary" onPress={onBack}>
          {t('sidestore.back')}
        </Button>
        <Button onPress={onClose}>{t('sidestore.done')}</Button>
      </Modal.Footer>
    </>
  )
}

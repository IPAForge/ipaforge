import { Button, Modal } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import type { UpdateIn } from '@ui/features/updates/types.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'

type ManualUpdateDialogProps = {
  state: UpdateIn<'manual'>
  onLater: () => void
}

/**
 * A newer version is out, but this copy came from a package that can't update itself (.msi, .deb, .rpm): which
 * file to download, and that installing it over this one keeps everything.
 */
export const ManualUpdateDialog = ({
  state,
  onLater
}: ManualUpdateDialogProps) => {
  const { t } = useTranslation()
  const { links } = useUiServices()
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) onLater()
  }
  const onDownload = () => {
    links.open(state.url)
    onLater()
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog role="alertdialog">
            <Modal.Header>
              <Modal.Heading>
                {t('updates.manual.title', { version: state.version })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <p>{t('updates.manual.body', { package: state.packageType })}</p>
              {state.fileName ? (
                <code className="break-all rounded-lg bg-surface-secondary px-3 py-2 text-muted text-xs">
                  {state.fileName}
                </code>
              ) : null}
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button variant="tertiary" onPress={onLater}>
                {t('updates.manual.later')}
              </Button>
              <Button onPress={onDownload}>
                {t('updates.manual.download', { version: state.version })}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

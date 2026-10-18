import { Button, Modal } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import type { ExportKind } from '@ui/features/logs/types.ts'

type ExportDialogProps = {
  kind: ExportKind
  count: number
  onConfirm: () => void
  onCancel: () => void
}

/** Before lines leave the app: how many, and that they name the device, apps and team. */
export const ExportDialog = ({
  kind,
  count,
  onConfirm,
  onCancel
}: ExportDialogProps) => {
  const { t } = useTranslation()
  const isCopy = kind === 'copy'
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) onCancel()
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog role="alertdialog">
            <Modal.Header>
              <Modal.Heading>
                {t(isCopy ? 'logs.export.copyTitle' : 'logs.export.saveTitle', {
                  count
                })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <p>
                {t(isCopy ? 'logs.export.copyBody' : 'logs.export.saveBody')}
              </p>
              <p className="text-muted text-sm">{t('logs.export.warning')}</p>
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button variant="tertiary" onPress={onCancel}>
                {t('prompts.cancel')}
              </Button>
              <Button onPress={onConfirm} autoFocus>
                {t(
                  isCopy ? 'logs.export.confirmCopy' : 'logs.export.confirmSave'
                )}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

import { Button, Modal } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { useSourceActions } from '@ui/hooks/queries/use-source-actions.ts'
import type { SourceInfo } from '@ui/services/engine/types.ts'

type RemoveSourceDialogProps = {
  source: SourceInfo
  name: string
  onClose: () => void
}

/** Asks before forgetting a source, saying what goes and what stays. */
export const RemoveSourceDialog = ({
  source,
  name,
  onClose
}: RemoveSourceDialogProps) => {
  const { t } = useTranslation()
  const { remove } = useSourceActions()
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen && !remove.isPending) onClose()
  }
  const onConfirm = () => remove.mutate(source.id, { onSuccess: onClose })

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog role="alertdialog">
            <Modal.Header>
              <Modal.Heading>
                {t('preload.removeSource.title', { name })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm">{t('preload.removeSource.body')}</p>
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button
                variant="tertiary"
                onPress={onClose}
                isDisabled={remove.isPending}
              >
                {t('prompts.cancel')}
              </Button>
              <Button
                variant="danger"
                onPress={onConfirm}
                isPending={remove.isPending}
                autoFocus
              >
                {t('preload.removeSource.confirm')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

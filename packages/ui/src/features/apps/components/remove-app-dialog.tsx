import { Alert, Button, Modal } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { toIPAForgeError } from '@ipaforge/kernel'
import type { AppView } from '@ui/features/apps/types.ts'
import { useRemoveApp } from '@ui/hooks/queries/use-remove-app.ts'
import { errorTitleKey } from '@ui/i18n/required-keys.ts'

type RemoveAppDialogProps = {
  view: AppView
  udid: string
  deviceName: string
  onClose: () => void
}

/** Asks before deleting an app from the device, saying it goes with its data and frees a free-app slot. */
export const RemoveAppDialog = ({
  view,
  udid,
  deviceName,
  onClose
}: RemoveAppDialogProps) => {
  const { t } = useTranslation()
  const remove = useRemoveApp()
  const onOpenChange = (isOpen: boolean) => {
    if (!(isOpen || remove.isPending)) onClose()
  }
  const onConfirm = () =>
    remove.mutate({ udid, bundleId: view.app.bundleId }, { onSuccess: onClose })

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog role="alertdialog">
            <Modal.Header>
              <Modal.Heading>
                {t('apps.removeDialog.title', { name: view.app.name })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <p className="text-sm">
                {t('apps.removeDialog.body', { device: deviceName })}
              </p>
              {remove.error ? (
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>
                      {t(errorTitleKey(toIPAForgeError(remove.error).code))}
                    </Alert.Title>
                  </Alert.Content>
                </Alert>
              ) : null}
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
                {t('apps.remove')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

import { Alert, Button, Modal, Spinner } from '@heroui/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { toIPAForgeError } from '@ipaforge/kernel'
import { errorTitleKey } from '@ui/i18n/required-keys.ts'

type ConfirmDialogProps = {
  title: string
  children: ReactNode
  confirmLabel: string
  isPending: boolean
  error: unknown
  onConfirm: () => void
  onClose: () => void
}

/** Asks before a change that can't be undone (revoke, delete, remove), and says why it failed if it did. */
export const ConfirmDialog = ({
  title,
  children,
  confirmLabel,
  isPending,
  error,
  onConfirm,
  onClose
}: ConfirmDialogProps) => {
  const { t } = useTranslation()
  const onOpenChange = (isOpen: boolean) => {
    if (!(isOpen || isPending)) onClose()
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog role="alertdialog">
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3 text-sm">
              {children}
              {error ? (
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>
                      {t(errorTitleKey(toIPAForgeError(error).code))}
                    </Alert.Title>
                  </Alert.Content>
                </Alert>
              ) : null}
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button
                variant="tertiary"
                onPress={onClose}
                isDisabled={isPending}
              >
                {t('prompts.cancel')}
              </Button>
              <Button
                variant="danger"
                onPress={onConfirm}
                isPending={isPending}
                autoFocus
              >
                {isPending ? <Spinner size="sm" color="current" /> : null}
                {confirmLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

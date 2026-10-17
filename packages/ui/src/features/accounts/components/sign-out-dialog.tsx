import { Alert, Button, Modal } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { toLoadstarError } from '@loadstar/kernel'
import { useSignOut } from '@ui/hooks/queries/use-sign-out.ts'
import { errorTitleKey } from '@ui/i18n/required-keys.ts'
import type { Account } from '@ui/services/engine/types.ts'

type SignOutDialogProps = {
  account: Account
  onClose: () => void
  /** The Engine forgot the account. */
  onSignedOut: (account: Account) => void
}

/** Asks before signing out, saying what Loadstar forgets and what it keeps. */
export const SignOutDialog = ({
  account,
  onClose,
  onSignedOut
}: SignOutDialogProps) => {
  const { t } = useTranslation()
  const signOut = useSignOut()
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen && !signOut.isPending) onClose()
  }
  const onConfirm = () =>
    signOut.mutate(account.id, { onSuccess: () => onSignedOut(account) })

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog role="alertdialog">
            <Modal.Header>
              <Modal.Heading>
                {t('accounts.signOut.title', { appleId: account.appleId })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <p>{t('accounts.signOut.forgets')}</p>
              <p className="text-muted text-sm">
                {t('accounts.signOut.keeps')}
              </p>
              {signOut.error ? (
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>
                      {t(errorTitleKey(toLoadstarError(signOut.error).code))}
                    </Alert.Title>
                  </Alert.Content>
                </Alert>
              ) : null}
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button
                variant="tertiary"
                onPress={onClose}
                isDisabled={signOut.isPending}
              >
                {t('prompts.cancel')}
              </Button>
              <Button
                variant="danger"
                onPress={onConfirm}
                isPending={signOut.isPending}
                autoFocus
              >
                {t('accounts.signOut.confirm')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

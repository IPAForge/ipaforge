import { Button, Modal, Spinner } from '@heroui/react'
import { useTranslation } from 'react-i18next'

type ResumingSignInProps = {
  appleId: string
  onCancel: () => void
}

/** "Sign in again" before Apple asks for anything: IPAForge uses what it saved for this Apple ID. */
export const ResumingSignIn = ({ appleId, onCancel }: ResumingSignInProps) => {
  const { t } = useTranslation()

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{t('signIn.resuming.title')}</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <p role="status" className="flex items-center gap-2">
          <Spinner size="sm" />
          {t('signIn.resuming.body', { appleId })}
        </p>
      </Modal.Body>
      <Modal.Footer className="flex justify-end">
        <Button variant="tertiary" onPress={onCancel}>
          {t('signIn.resuming.cancel')}
        </Button>
      </Modal.Footer>
    </>
  )
}

import { Button, Modal } from '@heroui/react'
import { CircleCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type SignedInProps = {
  appleId: string
  onDone: () => void
}

/** The end of a sign-in: which Apple ID IPAForge now has. */
export const SignedIn = ({ appleId, onDone }: SignedInProps) => {
  const { t } = useTranslation()

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{t('signIn.done.title')}</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <p role="status" className="flex items-center gap-2">
          <CircleCheck aria-hidden="true" className="size-5 text-success" />
          {t('signIn.done.body', { appleId })}
        </p>
      </Modal.Body>
      <Modal.Footer className="flex justify-end">
        <Button onPress={onDone} autoFocus>
          {t('signIn.done.close')}
        </Button>
      </Modal.Footer>
    </>
  )
}

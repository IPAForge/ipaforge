import { Button, Modal, Spinner } from '@heroui/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ActionError } from '@ui/features/apps/components/action-error.tsx'

type PairingConfirmStepProps = {
  title: string
  children: ReactNode
  confirmLabel: string
  tone: 'danger' | 'primary'
  isPending: boolean
  error: unknown
  onConfirm: () => void
  onBack: () => void
}

/** Asks before a pairing change (Remove, a new remote pairing); Cancel goes back to the list. */
export const PairingConfirmStep = ({
  title,
  children,
  confirmLabel,
  tone,
  isPending,
  error,
  onConfirm,
  onBack
}: PairingConfirmStepProps) => {
  const { t } = useTranslation()

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{title}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-3 text-sm">
        {children}
        <ActionError error={error} />
      </Modal.Body>
      <Modal.Footer className="flex justify-end gap-2">
        <Button variant="tertiary" onPress={onBack} isDisabled={isPending}>
          {t('prompts.cancel')}
        </Button>
        <Button
          variant={tone}
          onPress={onConfirm}
          isPending={isPending}
          autoFocus
        >
          {isPending ? <Spinner size="sm" color="current" /> : null}
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </>
  )
}

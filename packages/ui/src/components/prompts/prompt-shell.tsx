import { Button, Modal } from '@heroui/react'
import type { ReactNode, SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { TranslationKey } from '@ui/i18n/setup/types.ts'

export type PromptShellProps = {
  title: string
  description: string
  /** "Cancel install" during an install, "Cancel" while signing in. */
  declineLabelKey: TranslationKey
  onDecline: () => void
  /** With a submit label, the body is a form and Enter submits it. */
  submit?:
    | {
        labelKey: TranslationKey
        /** Values for the label's placeholders ("Place in {count} apps"). */
        labelValues?: Record<string, unknown> | undefined
        isDisabled: boolean
        onSubmit: () => void
        /** It can't be undone (revoking a certificate, removing an app): the button is red. */
        isDestructive?: boolean | undefined
      }
    | undefined
  /** Waiting for the Engine after the answer: Submit shows it is busy, nothing else can be pressed. */
  isPending?: boolean | undefined
  /** Announced while pending ("Checking the code…"). */
  pendingKey?: TranslationKey | undefined
  children?: ReactNode
}

/**
 * The dialog every question shares: a title, what it is about, the answer controls, Cancel and maybe Submit.
 * While the answer is being checked it stays as it is, so its name and place never change under the user.
 */
export const PromptShell = ({
  title,
  description,
  declineLabelKey,
  onDecline,
  submit,
  isPending = false,
  pendingKey,
  children
}: PromptShellProps) => {
  const { t } = useTranslation()
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen && !isPending) onDecline()
  }
  const onFormSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submit && !submit.isDisabled && !isPending) submit.onSubmit()
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen isDismissable={false} onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog aria-busy={isPending}>
            <form onSubmit={onFormSubmit} className="flex flex-col gap-4">
              <Modal.Header>
                <Modal.Heading>{title}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-muted text-sm">{description}</p>
                {children}
                <p aria-live="polite" className="min-h-5 text-muted text-sm">
                  {isPending && pendingKey ? t(pendingKey) : null}
                </p>
              </Modal.Body>
              <Modal.Footer className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="tertiary"
                  onPress={onDecline}
                  isDisabled={isPending}
                >
                  {t(declineLabelKey)}
                </Button>
                {submit ? (
                  <Button
                    type="submit"
                    variant={submit.isDestructive ? 'danger' : 'primary'}
                    isDisabled={submit.isDisabled}
                    isPending={isPending}
                  >
                    {t(submit.labelKey, submit.labelValues ?? {})}
                  </Button>
                ) : null}
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

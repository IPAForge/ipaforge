import { Modal } from '@heroui/react'
import type { ReactNode } from 'react'

import { SignInForm } from '@ui/features/accounts/sign-in/sign-in-form.tsx'
import { SignInPrompt } from '@ui/features/accounts/sign-in/sign-in-prompt.tsx'
import { SignedIn } from '@ui/features/accounts/sign-in/signed-in.tsx'
import { useSignIn } from '@ui/features/accounts/sign-in/use-sign-in.ts'
import type { Account } from '@ui/services/engine/engine-types.ts'

type SignInDialogProps = {
  /** "Sign in again" for a saved Apple ID: the form starts with it filled in. */
  appleId?: string | undefined
  onClose: () => void
  /** The account the Engine saved, e.g. to show or select it. */
  onSignedIn: (account: Account) => void
}

type ShellProps = {
  onClose: () => void
  children: ReactNode
}

const Shell = ({ onClose, children }: ShellProps) => {
  const onOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog>{children}</Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

/**
 * "Add Apple ID": the Apple ID and password, then a second factor if Apple asks for one, then who is signed in.
 * Mount it only while it is open: unmounting cancels a sign-in in progress.
 */
export const SignInDialog = ({
  appleId,
  onClose,
  onSignedIn
}: SignInDialogProps) => {
  const signIn = useSignIn(onSignedIn)
  const { state } = signIn
  if (state.phase === 'prompt')
    return (
      <SignInPrompt
        key={state.count}
        request={state.request}
        onAnswer={signIn.answer}
        onDecline={signIn.decline}
        isPending={state.isPending}
      />
    )

  return (
    <Shell onClose={onClose}>
      {state.phase === 'signed-in' ? (
        <SignedIn appleId={state.account.appleId} onDone={onClose} />
      ) : (
        <SignInForm
          initialAppleId={appleId}
          isBusy={state.isPending}
          error={state.error}
          onSubmit={signIn.start}
          onClose={onClose}
        />
      )}
    </Shell>
  )
}

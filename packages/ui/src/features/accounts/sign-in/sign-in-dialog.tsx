import { SignInForm } from '@ui/features/accounts/sign-in/components/sign-in-form.tsx'
import { SignInPrompt } from '@ui/features/accounts/sign-in/components/sign-in-prompt.tsx'
import { SignInShell } from '@ui/features/accounts/sign-in/components/sign-in-shell.tsx'
import { SignedIn } from '@ui/features/accounts/sign-in/components/signed-in.tsx'
import { useSignIn } from '@ui/features/accounts/sign-in/hooks/use-sign-in.ts'
import type { Account } from '@ui/services/engine/types.ts'

type SignInDialogProps = {
  /** "Sign in again" for a saved Apple ID: the form starts with it filled in. */
  appleId?: string | undefined
  onClose: () => void
  /** The account the Engine saved, e.g. to show or select it. */
  onSignedIn: (account: Account) => void
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
    <SignInShell onClose={onClose}>
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
    </SignInShell>
  )
}

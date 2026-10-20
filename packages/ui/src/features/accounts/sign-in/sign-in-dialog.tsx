import { useEffect, useRef } from 'react'

import { ResumingSignIn } from '@ui/features/accounts/sign-in/components/resuming-sign-in.tsx'
import { SignInForm } from '@ui/features/accounts/sign-in/components/sign-in-form.tsx'
import { SignInPrompt } from '@ui/features/accounts/sign-in/components/sign-in-prompt.tsx'
import { SignInShell } from '@ui/features/accounts/sign-in/components/sign-in-shell.tsx'
import { SignedIn } from '@ui/features/accounts/sign-in/components/signed-in.tsx'
import { useSignIn } from '@ui/features/accounts/sign-in/hooks/use-sign-in.ts'
import type { Account } from '@ui/services/engine/types.ts'

type SignInDialogProps = {
  /** "Sign in again" for a saved Apple ID: the form starts with it filled in. */
  appleId?: string | undefined
  /**
   * "Sign in again" for this saved account: it starts at once with what's saved, and asks only for what's missing
   * (usually the second factor's code; the password only when none is saved).
   */
  accountId?: string | undefined
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
  accountId,
  onClose,
  onSignedIn
}: SignInDialogProps) => {
  const signIn = useSignIn(onSignedIn)
  const { state } = signIn
  const resume = useRef(signIn.resume)
  resume.current = signIn.resume

  // Starts when the dialog opens. Unmounting cancels the run (the hook), so StrictMode's second mount starts again.
  useEffect(() => {
    if (accountId && appleId) resume.current(appleId, accountId)
  }, [accountId, appleId])

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
      {state.phase === 'resuming' ? (
        <ResumingSignIn appleId={appleId ?? ''} onCancel={onClose} />
      ) : null}
      {state.phase === 'signed-in' ? (
        <SignedIn appleId={state.account.appleId} onDone={onClose} />
      ) : null}
      {state.phase === 'form' ? (
        <SignInForm
          initialAppleId={appleId}
          isBusy={state.isPending}
          error={state.error}
          onSubmit={signIn.start}
          onClose={onClose}
        />
      ) : null}
    </SignInShell>
  )
}

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { toIPAForgeError } from '@ipaforge/kernel'
import { PromptKind } from '@ipaforge/rpc'
import type {
  SignInState,
  UseSignIn
} from '@ui/features/accounts/sign-in/types.ts'
import { afterRun } from '@ui/features/accounts/sign-in/utils/after-run.ts'
import { resetSignedInAccount } from '@ui/hooks/queries/account-cache.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import type { Account, SignInRun } from '@ui/services/engine/types.ts'

/**
 * Adds an Apple ID through the Engine's `signIn` run. The password typed in the form answers the run's password
 * question, so it is never part of the run's input; a second factor is asked through the prompt dialogs. Once the
 * Engine has saved the account, its cached answers are reset and the saved list read again (on demand; nothing
 * polls), so a "sign-in needed" from before shows as "Checking…" until Apple answers.
 */
export const useSignIn = (
  onSignedIn: (account: Account) => void
): UseSignIn => {
  const engine = useEngine()
  const queryClient = useQueryClient()
  const [state, setState] = useState<SignInState>({
    phase: 'form',
    isPending: false
  })
  const run = useRef<SignInRun | undefined>(undefined)
  const done = useRef(onSignedIn)
  done.current = onSignedIn

  // Closing the dialog mid sign-in cancels the run.
  useEffect(() => () => run.current?.cancel(), [])

  const follow = (handle: SignInRun, password: string) => {
    let count = 0
    let passwordSent = false
    handle.subscribe((event) => {
      if (event.type !== 'prompt') return
      if (event.request.kind === PromptKind.Password && !passwordSent) {
        passwordSent = true
        handle.answer(password)
        return
      }
      count += 1
      setState({
        phase: 'prompt',
        request: event.request,
        count,
        isPending: false
      })
    })
    handle.result.then(
      (result) => {
        if (run.current !== handle) return
        run.current = undefined
        const next = afterRun(result)
        setState(next)
        if (next.phase !== 'signed-in') return
        void resetSignedInAccount(queryClient, next.account.id)
        done.current(next.account)
      },
      (error: unknown) =>
        setState({
          phase: 'form',
          isPending: false,
          error: toIPAForgeError(error)
        })
    )
  }

  /** The question on screen stays there, pending, until the Engine moves on. */
  const respond = (act: (handle: SignInRun) => void) => {
    const handle = run.current
    if (!handle?.pending()) return
    act(handle)
    setState((current) =>
      current.phase === 'prompt' ? { ...current, isPending: true } : current
    )
  }

  return {
    state,
    start: (appleId, password, rememberPassword) => {
      const handle = engine.signIn({
        appleId: appleId.trim(),
        rememberPassword
      })
      run.current = handle
      setState({ phase: 'form', isPending: true })
      follow(handle, password)
    },
    answer: (answer) => respond((handle) => handle.answer(answer)),
    decline: () => respond((handle) => handle.decline())
  }
}

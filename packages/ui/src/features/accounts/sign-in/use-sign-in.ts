import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import {
  ErrorCode,
  type LoadstarError,
  toLoadstarError
} from '@loadstar/kernel'
import { PromptKind, type PromptRequest } from '@loadstar/rpc'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import type { Account, SignInRun } from '@ui/services/engine/engine-types.ts'

/**
 * Which step is on screen. A step stays on screen while the Engine works on its answer (`isPending`): the form
 * while Apple checks the password, the method choice while the code is sent, the code while it is checked. The
 * next step replaces it only when the Engine asks it or the run ends.
 */
export type SignInState =
  | {
      readonly phase: 'form'
      readonly isPending: boolean
      readonly error?: LoadstarError | undefined
    }
  | {
      readonly phase: 'prompt'
      readonly request: PromptRequest
      /** Counts the questions, so the same one asked again (a wrong code) gets a fresh dialog. */
      readonly count: number
      readonly isPending: boolean
    }
  | { readonly phase: 'signed-in'; readonly account: Account }

export type UseSignIn = {
  readonly state: SignInState
  start: (appleId: string, password: string) => void
  answer: (answer: unknown) => void
  decline: () => void
}

type Result = Awaited<SignInRun['result']>

/** Declining a question or cancelling goes back to the form without an error. */
const isStopped = (result: Result): boolean =>
  result.status === 'cancelled' ||
  (result.status === 'failed' &&
    result.error.code === ErrorCode.PromptCancelled)

const afterRun = (result: Result): SignInState => {
  if (result.status === 'completed' && result.state.account)
    return { phase: 'signed-in', account: result.state.account as Account }
  if (result.status === 'failed' && !isStopped(result))
    return { phase: 'form', isPending: false, error: result.error }
  return { phase: 'form', isPending: false }
}

/**
 * Adds an Apple ID through the Engine's `signIn` run. The password typed in the form answers the run's password
 * question, so it is never part of the run's input; a second factor is asked through the prompt dialogs. Once the
 * Engine has saved the account, the accounts query is invalidated (sign-in is on demand; nothing polls).
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
        void queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
        done.current(next.account)
      },
      (error: unknown) =>
        setState({
          phase: 'form',
          isPending: false,
          error: toLoadstarError(error)
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
    start: (appleId, password) => {
      const handle = engine.signIn({ appleId: appleId.trim() })
      run.current = handle
      setState({ phase: 'form', isPending: true })
      follow(handle, password)
    },
    answer: (answer) => respond((handle) => handle.answer(answer)),
    decline: () => respond((handle) => handle.decline())
  }
}

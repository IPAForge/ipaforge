import { ErrorCode } from '@loadstar/kernel'
import type {
  SignInResult,
  SignInState
} from '@ui/features/accounts/sign-in/types.ts'
import type { Account } from '@ui/services/engine/types.ts'

/** Declining a question or cancelling goes back to the form without an error. */
const isStopped = (result: SignInResult): boolean =>
  result.status === 'cancelled' ||
  (result.status === 'failed' &&
    result.error.code === ErrorCode.PromptCancelled)

/** The step a finished sign-in run leaves on screen: who is signed in, or the form (with the error, if any). */
export const afterRun = (result: SignInResult): SignInState => {
  if (result.status === 'completed' && result.state.account)
    return { phase: 'signed-in', account: result.state.account as Account }
  if (result.status === 'failed' && !isStopped(result))
    return { phase: 'form', isPending: false, error: result.error }
  return { phase: 'form', isPending: false }
}

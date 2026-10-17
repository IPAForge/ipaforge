import type { LoadstarError } from '@loadstar/kernel'
import type { PromptRequest } from '@loadstar/rpc'
import type { Account, SignInRun } from '@ui/services/engine/types.ts'

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
  /** `rememberPassword`: save the password in the system keychain, to renew an expired session without asking. */
  start: (appleId: string, password: string, rememberPassword: boolean) => void
  answer: (answer: unknown) => void
  decline: () => void
}

export type SignInResult = Awaited<SignInRun['result']>

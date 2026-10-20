import type { IPAForgeError } from '@ipaforge/kernel'
import type { PromptRequest } from '@ipaforge/rpc'
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
      readonly error?: IPAForgeError | undefined
    }
  | {
      readonly phase: 'prompt'
      readonly request: PromptRequest
      /** Counts the questions, so the same one asked again (a wrong code) gets a fresh dialog. */
      readonly count: number
      readonly isPending: boolean
    }
  /** "Sign in again": signing in with what the account has saved, before Apple asks for anything. */
  | { readonly phase: 'resuming' }
  | { readonly phase: 'signed-in'; readonly account: Account }

export type UseSignIn = {
  readonly state: SignInState
  /** `rememberPassword`: save the password in the system keychain, to renew an expired session without asking. */
  start: (appleId: string, password: string, rememberPassword: boolean) => void
  /** "Sign in again" for a saved account: its saved session or password first; asks only for what's missing. */
  resume: (appleId: string, accountId: string) => void
  answer: (answer: unknown) => void
  decline: () => void
}

export type SignInResult = Awaited<SignInRun['result']>

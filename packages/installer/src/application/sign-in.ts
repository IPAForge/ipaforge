// Opens a saved Apple account for a flow: its session when Apple still accepts it, else a sign-in with the saved
// password, else the password from the user. A second factor is completed through prompts.
import { ask } from '@installer/application/ask.ts'
import { completeTwoFactor } from '@installer/application/two-factor.ts'
import type { InstallerDeps } from '@installer/deps.ts'
import { PromptKind } from '@installer/domain/prompts.ts'
import type { StepContext } from '@installer/pipeline/step.ts'
import type { AppleSession, SavedAccount, SignInResult } from '@loadstar/apple'

const finish = async (
  deps: InstallerDeps,
  context: StepContext,
  result: SignInResult
): Promise<AppleSession> => {
  if (result.kind === 'signed_in') return result.session
  const session = await completeTwoFactor(
    context,
    result.challenge,
    deps.config.twoFactorAttempts
  )
  await deps.apple.accounts.save(session)
  return session
}

const signInWithPassword = async (
  deps: InstallerDeps,
  context: StepContext,
  appleId: string
) => {
  const password = await ask(context, PromptKind.Password, { appleId })
  const result = await deps.apple.signIn({
    appleId,
    password,
    signal: context.signal
  })
  if (result.kind === 'signed_in')
    await deps.apple.accounts.save(result.session)
  return result
}

export const signInAccount = async (
  deps: InstallerDeps,
  context: StepContext,
  accountId: string
): Promise<AppleSession> => {
  const resumed = await deps.apple.resume(accountId)
  if (resumed.kind !== 'needs_password') return finish(deps, context, resumed)
  return finish(
    deps,
    context,
    await signInWithPassword(deps, context, resumed.appleId)
  )
}

/**
 * Signs in an Apple ID that is not saved yet (the password and any second factor through prompts) and saves it.
 * With `rememberPassword` the password is saved too (only through the SecretStore), so an expired session can
 * be renewed without asking.
 */
export const signInNewAccount = async (
  deps: InstallerDeps,
  context: StepContext,
  appleId: string,
  rememberPassword = false
): Promise<SavedAccount> => {
  const password = await ask(context, PromptKind.Password, { appleId })
  const result = await deps.apple.signIn({
    appleId,
    password,
    signal: context.signal
  })
  const session =
    result.kind === 'signed_in'
      ? result.session
      : await completeTwoFactor(
          context,
          result.challenge,
          deps.config.twoFactorAttempts
        )

  return deps.apple.accounts.save(
    session,
    rememberPassword ? { rememberPassword: password } : {}
  )
}

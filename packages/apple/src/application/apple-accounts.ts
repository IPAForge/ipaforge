// The public facade of @ipaforge/apple: anisette, sign-in with 2FA, app tokens, saved accounts and preflight.

import { createAccountStore } from '@apple/application/accounts.ts'
import { createAnisetteService } from '@apple/application/anisette.ts'
import {
  createAppTokenService,
  XCODE_APP
} from '@apple/application/app-token.ts'
import { createDeveloperServices } from '@apple/application/developer.ts'
import { runPreflight } from '@apple/application/preflight.ts'
import { createSignInService } from '@apple/application/sign-in.ts'
import type {
  AccountStore,
  AppleAccounts,
  AppleAccountsOptions,
  ResumeResult,
  ResumeServices,
  SavedAccount
} from '@apple/application/types.ts'
import { resolveAppleDeps } from '@apple/deps.ts'
import type { AppleSession } from '@apple/domain/types.ts'
import type { AppleDepsInput } from '@apple/types.ts'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const findSaved = async (
  accounts: AccountStore,
  id: string
): Promise<SavedAccount | undefined> =>
  (await accounts.list()).find((candidate) => candidate.id === id)

const isSessionExpired = (error: unknown): error is IPAForgeError =>
  error instanceof IPAForgeError && error.code === ErrorCode.SessionExpired

/** The saved session when Apple still accepts it (checked with an app token request). */
const reuseSession = async (
  services: ResumeServices,
  id: string
): Promise<AppleSession | undefined> => {
  const session = await services.accounts.session(id)
  if (!session) {
    services.deps.logger.info('no saved session', { account: id })
    return undefined
  }
  try {
    await services.tokens.appToken(session, XCODE_APP)
    await services.accounts.update(id, {
      health: { lastSuccessAt: services.deps.clock.now().toISOString() }
    })
    return session
  } catch (error) {
    if (!isSessionExpired(error)) throw error
    // Why Apple refused it (its status, the request), never the session itself.
    services.deps.logger.info('saved session not accepted', {
      account: id,
      code: error.code,
      request: error.data?.request,
      gsaCode: error.data?.gsaCode,
      hsc: error.data?.hsc
    })
    return undefined
  }
}

/** Opens a saved account: its session, else a sign-in with its saved password, else "needs the password". */
export const resumeAccount = async (
  services: ResumeServices,
  id: string
): Promise<ResumeResult> => {
  const account = await findSaved(services.accounts, id)
  if (!account)
    throw new IPAForgeError(ErrorCode.AccountNotFound, { data: { id } })
  const session = await reuseSession(services, id)
  if (session) return { kind: 'signed_in', session }
  const password = await services.accounts.password(id)
  if (!password) {
    services.deps.logger.debug('no saved password; the password is needed', {
      account: id
    })
    return { kind: 'needs_password', appleId: account.appleId }
  }
  services.deps.logger.debug('signing in again with the saved password', {
    account: id
  })
  const result = await services.signIn.signIn({
    appleId: account.appleId,
    password
  })
  if (result.kind === 'signed_in') await services.accounts.save(result.session)
  return result
}

export const createAppleAccounts = (
  input: AppleDepsInput,
  options: AppleAccountsOptions = {}
): AppleAccounts => {
  const deps = resolveAppleDeps(input)
  const anisette = createAnisetteService(
    deps,
    compact({ custom: options.customAnisetteServer })
  )
  const signInService = createSignInService(deps, anisette)
  const tokens = createAppTokenService(deps, anisette)
  const accounts = createAccountStore(deps.secrets, deps.clock)
  const resumeServices: ResumeServices = {
    deps,
    accounts,
    tokens,
    signIn: signInService
  }

  return {
    anisette,
    accounts,
    preflight: () => runPreflight(deps, anisette),
    signIn: (signInInput) => signInService.signIn(signInInput),
    appToken: (session, app) => tokens.appToken(session, app),
    resume: (id) => resumeAccount(resumeServices, id),
    developer: (session) =>
      createDeveloperServices(deps, anisette, tokens, session),
    markBanned: async (id, udid) => {
      const account = await findSaved(accounts, id)
      await accounts.update(id, {
        health: {
          bannedOnDevices: [...(account?.health.bannedOnDevices ?? []), udid],
          lastError: ErrorCode.ProfileBanned
        }
      })
    }
  }
}

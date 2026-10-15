// The public facade of @loadstar/apple: anisette, sign-in with 2FA, app tokens, saved accounts and preflight.

import {
  type AccountStore,
  createAccountStore,
  type SavedAccount
} from '@apple/application/accounts.ts'
import {
  type AnisetteService,
  createAnisetteService
} from '@apple/application/anisette.ts'
import {
  type AppTokenService,
  createAppTokenService,
  XCODE_APP
} from '@apple/application/app-token.ts'
import {
  createDeveloperServices,
  type DeveloperServices
} from '@apple/application/developer.ts'
import {
  type PreflightReport,
  runPreflight
} from '@apple/application/preflight.ts'
import {
  createSignInService,
  type SignInInput,
  type SignInResult,
  type SignInService
} from '@apple/application/sign-in.ts'
import {
  type AppleDeps,
  type AppleDepsInput,
  resolveAppleDeps
} from '@apple/deps.ts'
import type { AnisetteServer } from '@apple/domain/config.ts'
import type { AppleSession, AppToken } from '@apple/domain/session.ts'
import { compact, ErrorCode, LoadstarError } from '@loadstar/kernel'

export type ResumeResult =
  | SignInResult
  | { readonly kind: 'needs_password'; readonly appleId: string }

export type AppleAccounts = {
  readonly anisette: AnisetteService
  readonly accounts: AccountStore
  preflight(): Promise<PreflightReport>
  signIn(input: SignInInput): Promise<SignInResult>
  appToken(session: AppleSession, app?: string): Promise<AppToken>
  /**
   * Re-opens a saved account: reuses its session while Apple accepts it, otherwise signs in again with the
   * saved password (usually without 2FA, since this machine is already known), otherwise asks for the password.
   */
  resume(id: string): Promise<ResumeResult>
  /** Developer services (teams, certificates, App IDs, profiles) for a signed-in session. */
  developer(session: AppleSession): DeveloperServices
  /** Records that Apple blocked this account's profiles on a device, so the UI can offer another account. */
  markBanned(id: string, udid: string): Promise<void>
}

export type AppleAccountsOptions = {
  /** A user-configured anisette server, tried first. */
  readonly customAnisetteServer?: AnisetteServer
}

const findSaved = async (
  accounts: AccountStore,
  id: string
): Promise<SavedAccount | undefined> =>
  (await accounts.list()).find((candidate) => candidate.id === id)

const isSessionExpired = (error: unknown): boolean =>
  error instanceof LoadstarError && error.code === ErrorCode.SessionExpired

type ResumeServices = {
  readonly deps: AppleDeps
  readonly accounts: AccountStore
  readonly tokens: AppTokenService
  readonly signIn: SignInService
}

/** The saved session when Apple still accepts it (checked with an app token request). */
const reuseSession = async (
  services: ResumeServices,
  id: string
): Promise<AppleSession | undefined> => {
  const session = await services.accounts.session(id)
  if (!session) return undefined
  try {
    await services.tokens.appToken(session, XCODE_APP)
    await services.accounts.update(id, {
      health: { lastSuccessAt: services.deps.clock.now().toISOString() }
    })
    return session
  } catch (error) {
    if (!isSessionExpired(error)) throw error
    services.deps.logger.info('saved session expired', { account: id })
    return undefined
  }
}

const resumeAccount = async (
  services: ResumeServices,
  id: string
): Promise<ResumeResult> => {
  const account = await findSaved(services.accounts, id)
  if (!account)
    throw new LoadstarError(ErrorCode.AccountNotFound, { data: { id } })
  const session = await reuseSession(services, id)
  if (session) return { kind: 'signed_in', session }
  const password = await services.accounts.password(id)
  if (!password) return { kind: 'needs_password', appleId: account.appleId }
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

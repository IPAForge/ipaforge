// Apple ID sign-in: SRP against GrandSlam, then (when Apple asks) a second factor. Wrong passwords are never
// retried automatically, so the user cannot be locked out by the app.

import { authenticate } from '@apple/application/gsa-authenticate.ts'
import { createTwoFactorChallenge } from '@apple/application/two-factor.ts'
import type {
  AnisetteService,
  Authenticated,
  Credentials,
  SignInInput,
  SignInResult,
  SignInService,
  TwoFactorChallenge
} from '@apple/application/types.ts'
import { GsaCode } from '@apple/domain/constants.ts'
import { normalizeAppleId } from '@apple/domain/session.ts'
import type { AppleSession, SecondFactorRequest } from '@apple/domain/types.ts'
import type { AppleDeps } from '@apple/types.ts'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const isAnisetteNotProvisioned = (error: unknown): boolean =>
  error instanceof IPAForgeError &&
  error.data?.gsaCode === GsaCode.AnisetteNotProvisioned

export const createSignInService = (
  deps: AppleDeps,
  anisette: AnisetteService
): SignInService => {
  /** Authenticates; when the machine identity went stale, re-provisions once and tries again (catalogue: -45061). */
  const authenticateWithReset = async (
    credentials: Credentials
  ): Promise<Authenticated> => {
    const getOptions = compact({ signal: credentials.signal })
    const data = await anisette.get(getOptions)
    try {
      return await authenticate(deps, data, anisette.resync, credentials)
    } catch (error) {
      if (!isAnisetteNotProvisioned(error)) throw error
      deps.logger.warn('anisette not provisioned for Apple; resetting it', {
        server: data.server
      })
      await anisette.reset()
      return authenticate(
        deps,
        await anisette.get(getOptions),
        anisette.resync,
        credentials
      )
    }
  }

  const startTwoFactor = (
    input: SignInInput,
    session: AppleSession,
    secondFactor: SecondFactorRequest
  ): Promise<TwoFactorChallenge> =>
    createTwoFactorChallenge(
      deps,
      () => anisette.get(),
      session,
      secondFactor.kind,
      // After the code is accepted, signing in again completes without a second factor.
      () =>
        signIn(input).then((retry) => {
          if (retry.kind === 'signed_in') return retry.session
          throw new IPAForgeError(ErrorCode.TwoFactorRequired, {
            message: 'Apple still asks for a second factor'
          })
        }),
      { codeAlreadySent: secondFactor.codeAlreadySent }
    )

  const signIn = async (input: SignInInput): Promise<SignInResult> => {
    const credentials = compact({
      appleId: normalizeAppleId(input.appleId),
      password: input.password,
      signal: input.signal
    })
    const result = await authenticateWithReset(credentials)
    deps.logger.info('password accepted', {
      secondFactor: result.secondFactor?.kind ?? 'none',
      codeAlreadySent: result.secondFactor?.codeAlreadySent ?? false
    })
    if (!result.secondFactor)
      return { kind: 'signed_in', session: result.session }
    return {
      kind: 'two_factor',
      challenge: await startTwoFactor(
        input,
        result.session,
        result.secondFactor
      )
    }
  }

  return { signIn }
}

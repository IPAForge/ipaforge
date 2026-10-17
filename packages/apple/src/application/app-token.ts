// App tokens: short-lived tokens for Apple services (e.g. `com.apple.gs.xcode.auth` for developer services),
// requested with the signed-in session and decrypted with its session key.

import { anisetteForSession } from '@apple/application/session-anisette.ts'
import type { AnisetteService } from '@apple/application/types.ts'
import { assertGsaOk } from '@apple/domain/gsa-status.ts'
import type { AppleSession, AppToken } from '@apple/domain/types.ts'
import {
  decryptAppToken,
  hmacSha256
} from '@apple/infrastructure/crypto/session.ts'
import {
  clientProvidedData,
  gsaRequest
} from '@apple/infrastructure/gsa/client.ts'
import { plistNumber } from '@apple/infrastructure/plist-fields.ts'
import type { AppleDeps } from '@apple/types.ts'
import {
  createDict,
  ErrorCode,
  isPlistDict,
  LoadstarError,
  type PlistDict,
  parsePlist,
  toLoadstarError,
  utf8Encode
} from '@loadstar/kernel'

export const XCODE_APP = 'com.apple.gs.xcode.auth'

/** Renew a cached token this long before it expires. */
const EXPIRY_MARGIN_MS = 60_000
const HSC_UNAUTHORIZED = 401

export type AppTokenService = {
  appToken(session: AppleSession, app?: string): Promise<AppToken>
}

/** Asks GrandSlam for `app`'s token and returns the encrypted token blob (`et`). */
const requestEncryptedToken = async (
  deps: AppleDeps,
  anisette: AnisetteService,
  session: AppleSession,
  app: string
): Promise<Uint8Array> => {
  const data = await anisetteForSession(anisette, session)
  const checksum = await hmacSha256(
    session.sessionKey,
    utf8Encode(`apptokens${session.adsid}${app}`)
  )
  const { response, status } = await gsaRequest(
    deps,
    data,
    createDict([
      ['app', [app]],
      ['c', session.cookie],
      ['checksum', checksum],
      ['cpd', clientProvidedData(deps, data)],
      ['o', 'apptokens'],
      ['t', session.idmsToken],
      ['u', session.adsid]
    ])
  )
  if (status.ec !== 0)
    // Diagnostics for "sign-in needed": Apple's own status, never the token or the session.
    deps.logger.info('app token request refused', {
      request: 'apptokens',
      app,
      gsaCode: status.ec,
      hsc: status.hsc,
      anisetteServer: data.server,
      sessionAnisetteServer: session.anisetteServer
    })
  if (status.ec !== 0 && status.hsc === HSC_UNAUTHORIZED)
    throw new LoadstarError(ErrorCode.SessionExpired, {
      message: 'Apple refused the session for an app token',
      data: { request: 'apptokens', gsaCode: status.ec, hsc: status.hsc }
    })
  assertGsaOk(status, 'apptokens')
  const et = response.et
  if (!(et instanceof Uint8Array))
    throw new LoadstarError(ErrorCode.AppleProtocolError, { message: 'no et' })
  return et
}

/** `app`'s entry in the decrypted token dict (`t`). */
const tokenEntry = (
  plain: ReturnType<typeof parsePlist>,
  app: string
): PlistDict & { token: string } => {
  const tokens =
    isPlistDict(plain) && isPlistDict(plain.t) ? plain.t : undefined
  const entry = tokens?.[app]
  if (!isPlistDict(entry) || typeof entry.token !== 'string') {
    throw new LoadstarError(ErrorCode.AppleProtocolError, {
      message: `no token for ${app}`
    })
  }
  return entry as PlistDict & { token: string }
}

export const createAppTokenService = (
  deps: AppleDeps,
  anisette: AnisetteService
): AppTokenService => {
  const cache = new Map<string, AppToken>()
  const nowMs = () => deps.clock.now().getTime()
  const isFresh = (token: AppToken) =>
    token.expiresAt.getTime() - EXPIRY_MARGIN_MS > nowMs()

  return {
    appToken: async (session, app = XCODE_APP) => {
      const key = `${session.adsid}/${app}`
      const cached = cache.get(key)
      if (cached && isFresh(cached)) return cached

      const et = await requestEncryptedToken(
        deps,
        anisette,
        session,
        app
      ).catch((error: unknown) => {
        deps.logger.info('app token request failed', {
          request: 'apptokens',
          app,
          code: toLoadstarError(error).code
        })
        throw error
      })
      const entry = tokenEntry(
        parsePlist(await decryptAppToken(session.sessionKey, et)),
        app
      )
      const durationSeconds = plistNumber(entry.duration) ?? 0
      const token: AppToken = {
        app,
        token: entry.token,
        expiresAt: new Date(
          plistNumber(entry.expiry) ?? nowMs() + durationSeconds * 1000
        )
      }
      cache.set(key, token)
      return token
    }
  }
}

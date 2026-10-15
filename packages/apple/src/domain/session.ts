import { ErrorCode, LoadstarError } from '@loadstar/kernel'

/** A signed-in Apple ID. Secret: whoever holds it can act as the user towards Apple. */
export type AppleSession = {
  /** Normalised Apple ID (email lowercased, or phone number). */
  readonly appleId: string
  /** Apple's account identifier (`adsid`). */
  readonly adsid: string
  /** `GsIdmsToken`: identifies the session in 2FA and app-token requests. */
  readonly idmsToken: string
  /** Session key for app-token requests (`sk`). */
  readonly sessionKey: Uint8Array
  /** Cookie for app-token requests (`c`). */
  readonly cookie: Uint8Array
  readonly firstName?: string
  readonly lastName?: string
  /** The anisette server the session was created with (Apple ties the session to that machine identity). */
  readonly anisetteServer: string
}

export type AppToken = {
  readonly app: string
  readonly token: string
  readonly expiresAt: Date
}

/** Normalises what the user typed as an Apple ID: emails are trimmed and lowercased; phone numbers keep `+`. */
export const normalizeAppleId = (input: string): string => {
  const trimmed = input.trim()
  if (trimmed.includes('@')) return trimmed.toLowerCase()
  const digits = trimmed.replace(/[\s().-]/g, '')

  return /^\+?\d{6,15}$/.test(digits) ? digits : trimmed
}

/** Second factor requested by GSA (`Status.au`). */
export type SecondFactorKind = 'trusted_device' | 'sms'

export type SecondFactorRequest = {
  readonly kind: SecondFactorKind
  /** Apple already pushed a code to the trusted devices; go straight to code entry. */
  readonly codeAlreadySent: boolean
}

/** GSA `Status.hsc` meaning "a second-factor code was already sent". */
const HSC_CODE_ALREADY_SENT = 409

/**
 * What the `complete` status asks for:
 * - `au = trustedDeviceSecondaryAuth` → trusted-device code; `au = secondaryAuth` → SMS;
 * - `hsc = 409` without `au` → a trusted-device code was already sent (Apple pushes it on its own);
 * - `au = repair` or nothing → signed in (the account has no 2FA to complete).
 * An unknown `au` value throws, so a new Apple step is reported instead of being mistaken for success.
 */
export const secondFactorFromStatus = (status: {
  au?: string
  hsc?: number
}): SecondFactorRequest | undefined => {
  switch (status.au) {
    case 'trustedDeviceSecondaryAuth':
      return {
        kind: 'trusted_device',
        codeAlreadySent: status.hsc === HSC_CODE_ALREADY_SENT
      }
    case 'secondaryAuth':
      return { kind: 'sms', codeAlreadySent: false }
    case 'repair':
      return undefined
    case undefined:
      return status.hsc === HSC_CODE_ALREADY_SENT
        ? { kind: 'trusted_device', codeAlreadySent: true }
        : undefined
    default:
      throw new LoadstarError(ErrorCode.TwoFactorUnsupported, {
        message: `Apple asked for an unknown sign-in step: ${status.au}`,
        data: { au: status.au }
      })
  }
}

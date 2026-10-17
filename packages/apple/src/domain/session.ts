import type {
  SecondFactorAu,
  SecondFactorRequest
} from '@apple/domain/types.ts'
import { ErrorCode, LoadstarError } from '@loadstar/kernel'

/** Normalises what the user typed as an Apple ID: emails are trimmed and lowercased; phone numbers keep `+`. */
export const normalizeAppleId = (input: string): string => {
  const trimmed = input.trim()
  if (trimmed.includes('@')) return trimmed.toLowerCase()
  const digits = trimmed.replace(/[\s().-]/g, '')

  return /^\+?\d{6,15}$/.test(digits) ? digits : trimmed
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
const SECOND_FACTOR_BY_AU = {
  trustedDeviceSecondaryAuth: (hsc) => ({
    kind: 'trusted_device',
    codeAlreadySent: hsc === HSC_CODE_ALREADY_SENT
  }),
  secondaryAuth: () => ({ kind: 'sms', codeAlreadySent: false }),
  repair: () => undefined
} satisfies Record<
  SecondFactorAu,
  (hsc: number | undefined) => SecondFactorRequest | undefined
>

const isKnownAu = (au: string): au is SecondFactorAu =>
  Object.hasOwn(SECOND_FACTOR_BY_AU, au)

export const secondFactorFromStatus = (status: {
  au?: string
  hsc?: number
}): SecondFactorRequest | undefined => {
  if (status.au === undefined)
    return status.hsc === HSC_CODE_ALREADY_SENT
      ? { kind: 'trusted_device', codeAlreadySent: true }
      : undefined
  if (isKnownAu(status.au)) return SECOND_FACTOR_BY_AU[status.au](status.hsc)
  throw new LoadstarError(ErrorCode.TwoFactorUnsupported, {
    message: `Apple asked for an unknown sign-in step: ${status.au}`,
    data: { au: status.au }
  })
}

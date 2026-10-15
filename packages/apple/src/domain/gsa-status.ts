// GrandSlam status codes → catalogued errors (see docs/design/failure-catalogue.md §2).
import { nonEmpty } from '@apple/domain/values.ts'
import { compact, ErrorCode, LoadstarError } from '@loadstar/kernel'

/** GSA error codes (`Status.ec`) with a dedicated meaning. */
export const GsaCode = {
  ClientRejected: -80045,
  /** Same message as -80045 ("This action cannot be completed at this time"), seen at `init` in Oct 2026. */
  ClientRejectedAlt: -90010,
  /** "This action could not be completed. Try again." (seen for unknown accounts). */
  ActionNotCompleted: -22421,
  AccountRefused: -22411,
  WrongPassword: -22406,
  AccountLocked: -20209,
  IncorrectVerificationCode: -21669,
  SmsUnavailable: -28248,
  SmsAlreadySent1: -22979,
  SmsAlreadySent2: -22981,
  AnisetteNotProvisioned: -45061,
  IncorrectCredentials: -20101,
  /** "Your account information was entered incorrectly." (unknown Apple ID) */
  AccountInfoIncorrect: -20970
} as const

/** HTTP-ish status (`Status.hsc`) values GSA uses. */
export const GsaHsc = {
  CodeAlreadySent: 409,
  ResyncAnisette: 434
} as const

const BY_EC: Readonly<Record<number, ErrorCode>> = {
  [GsaCode.ClientRejected]: ErrorCode.ClientRejected,
  [GsaCode.ClientRejectedAlt]: ErrorCode.ClientRejected,
  [GsaCode.ActionNotCompleted]: ErrorCode.AccountRefused,
  [GsaCode.AccountRefused]: ErrorCode.AccountRefused,
  [GsaCode.WrongPassword]: ErrorCode.InvalidCredentials,
  [GsaCode.IncorrectCredentials]: ErrorCode.InvalidCredentials,
  [GsaCode.AccountInfoIncorrect]: ErrorCode.InvalidCredentials,
  [GsaCode.AccountLocked]: ErrorCode.AccountLocked,
  [GsaCode.IncorrectVerificationCode]: ErrorCode.TwoFactorInvalidCode,
  [GsaCode.SmsUnavailable]: ErrorCode.SmsUnavailable,
  [GsaCode.AnisetteNotProvisioned]: ErrorCode.AnisetteNotProvisioned
}

const LOCKED_MESSAGE = /locked for security reasons/i

export type GsaStatus = {
  readonly ec: number
  readonly em?: string
  readonly hsc?: number
  /** Second-factor requirement: `trustedDeviceSecondaryAuth`, `secondaryAuth`, `repair`. */
  readonly au?: string
  /** `X-Apple-I-MD-DATA` (base64) sent with hsc 434: hand it to the anisette server to resync, then retry. */
  readonly resyncData?: string
}

/** True when GSA asks for an anisette resync before it will continue. */
export const needsAnisetteResync = (
  status: GsaStatus
): status is GsaStatus & { resyncData: string } =>
  status.hsc === GsaHsc.ResyncAnisette &&
  typeof status.resyncData === 'string' &&
  status.resyncData.length > 0

/** True for responses that mean "a code was already sent; just ask for it". */
export const isCodeAlreadySent = (status: GsaStatus): boolean =>
  status.ec === GsaCode.SmsAlreadySent1 ||
  status.ec === GsaCode.SmsAlreadySent2 ||
  status.hsc === GsaHsc.CodeAlreadySent

export const gsaErrorCode = (status: GsaStatus): ErrorCode => {
  if (status.em && LOCKED_MESSAGE.test(status.em))
    return ErrorCode.AccountLocked
  return BY_EC[status.ec] ?? ErrorCode.AppleProtocolError
}

/** Throws the catalogued error for a non-zero GSA status. */
export const assertGsaOk = (status: GsaStatus, operation: string): void => {
  if (status.ec === 0) return
  throw new LoadstarError(gsaErrorCode(status), {
    message: `GSA ${operation} failed: ${status.ec}${status.em ? ` ${status.em}` : ''}`,
    data: compact({
      gsaCode: status.ec,
      gsaMessage: nonEmpty(status.em),
      operation
    })
  })
}

/** HTTP status from Apple's front door → error code (before any GSA status is available). */
export const httpErrorCode = (status: number): ErrorCode =>
  status === 429
    ? ErrorCode.RateLimited
    : status >= 500
      ? ErrorCode.AppleServiceUnavailable
      : ErrorCode.AppleProtocolError

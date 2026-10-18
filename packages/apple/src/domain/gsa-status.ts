// GrandSlam status codes → catalogued errors (see docs/design/failure-catalogue.md §2).
import { GSA_ERROR_BY_EC, GsaCode, GsaHsc } from '@apple/domain/constants.ts'
import { nonEmpty } from '@apple/domain/values.ts'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const LOCKED_MESSAGE = /locked for security reasons/i
const HTTP_TOO_MANY_REQUESTS = 429
const HTTP_SERVER_ERROR = 500

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
  return GSA_ERROR_BY_EC[status.ec] ?? ErrorCode.AppleProtocolError
}

/** Throws the catalogued error for a non-zero GSA status. */
export const assertGsaOk = (status: GsaStatus, operation: string): void => {
  if (status.ec === 0) return
  const suffix = status.em ? ` ${status.em}` : ''
  throw new IPAForgeError(gsaErrorCode(status), {
    message: `GSA ${operation} failed: ${status.ec}${suffix}`,
    data: compact({
      gsaCode: status.ec,
      gsaMessage: nonEmpty(status.em),
      operation
    })
  })
}

/** HTTP status from Apple's front door → error code (before any GSA status is available). */
export const httpErrorCode = (status: number): ErrorCode => {
  if (status === HTTP_TOO_MANY_REQUESTS) return ErrorCode.RateLimited
  if (status >= HTTP_SERVER_ERROR) return ErrorCode.AppleServiceUnavailable
  return ErrorCode.AppleProtocolError
}

// Apple's result codes and how they map to catalogued errors (see docs/design/failure-catalogue.md §2).
import { ErrorCode } from '@ipaforge/kernel'

/** Developer-API `resultCode` values with a dedicated meaning (failure catalogue §2). */
export const DeveloperCode = {
  InvalidName: 35,
  SessionExpired: 1100,
  NotEligible: 1102,
  EmailUnverified: 2160,
  TeamAgreement: 4550,
  DeviceLimit: 5405,
  CertificateNotFound: 7252,
  CertificateLimit: 7460,
  CertificateNotRevocable: 7475,
  NoDevices: 8220,
  AppIdUnavailable: 9401
} as const

export const DEVELOPER_ERROR_BY_CODE: Readonly<Record<number, ErrorCode>> = {
  [DeveloperCode.InvalidName]: ErrorCode.InvalidAppIdName,
  [DeveloperCode.SessionExpired]: ErrorCode.SessionExpired,
  [DeveloperCode.NotEligible]: ErrorCode.NotEligibleForDevelopment,
  [DeveloperCode.EmailUnverified]: ErrorCode.EmailUnverified,
  [DeveloperCode.TeamAgreement]: ErrorCode.TeamAgreementRequired,
  [DeveloperCode.DeviceLimit]: ErrorCode.DeviceLimit,
  [DeveloperCode.CertificateNotFound]: ErrorCode.CertificateNotRevocable,
  [DeveloperCode.CertificateLimit]: ErrorCode.CertificateLimit,
  [DeveloperCode.CertificateNotRevocable]: ErrorCode.CertificateNotRevocable,
  [DeveloperCode.NoDevices]: ErrorCode.NoDevicesForProfile,
  [DeveloperCode.AppIdUnavailable]: ErrorCode.AppIdUnavailable
}

export const DEVELOPER_MESSAGE_PATTERNS: readonly (readonly [
  RegExp,
  ErrorCode
])[] = [
  [
    /too many certificates|maximum number of certificates|current .*certificate or a pending/i,
    ErrorCode.CertificateLimit
  ],
  [
    /maximum number of (registered )?app ids|not enough available app ids/i,
    ErrorCode.AppIdQuotaExceeded
  ]
]

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

export const GSA_ERROR_BY_EC: Readonly<Record<number, ErrorCode>> = {
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

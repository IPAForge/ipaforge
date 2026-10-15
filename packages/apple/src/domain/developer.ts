// Apple developer-account resources as Loadstar uses them, plus the rules that keep free accounts within Apple's
// limits (10 App IDs per 7 days, few development certificates).
import { compact, ErrorCode, type PlistDict } from '@loadstar/kernel'

export type Team = {
  readonly id: string
  readonly name: string
  /** e.g. "Individual", "Company/Organization" (as Apple reports it). */
  readonly type?: string
  readonly status?: string
  /** Free (personal) team: 7-day profiles, App ID quota. */
  readonly isFree: boolean
}

export type RegisteredDevice = {
  readonly id?: string
  readonly udid: string
  readonly name?: string
  readonly status?: string
}

export type DevelopmentCertificate = {
  readonly id?: string
  readonly serialNumber: string
  readonly name?: string
  /** Which computer/tool created it (Loadstar, Xcode, SideStore, …): shown in the revoke picker. */
  readonly machineName?: string
  readonly machineId?: string
  /** DER. */
  readonly content?: Uint8Array
  readonly platform?: string
  readonly status?: string
  readonly expiresAt?: Date
}

export type AppId = {
  readonly id: string
  /** Bundle identifier, e.g. `com.SideStore.SideStore.ABCDE12345`. */
  readonly identifier: string
  readonly name: string
  readonly features: PlistDict
  /** Free accounts: when this App ID stops counting against the quota. */
  readonly expiresAt?: Date
}

export type AppIdQuota = {
  readonly max?: number
  /** Never negative (Apple sometimes reports negative numbers). */
  readonly available: number
}

export type AppGroup = {
  /** Apple's id (`applicationGroup`). */
  readonly id: string
  readonly identifier: string
  readonly name?: string
}

export type ProvisioningProfile = {
  readonly id: string
  readonly uuid: string
  readonly name: string
  /** The signed `.mobileprovision` bytes. */
  readonly data: Uint8Array
  readonly expiresAt: Date
  readonly appIdId: string
}

/** Feature flag that enables App Groups on an App ID. */
export const APP_GROUPS_FEATURE = 'APG3427HIY'

/** Apple accepts only ASCII letters and digits in App ID and group names, and never an empty name. */
export const normalizeAppIdName = (name: string): string => {
  const normalized = [...name]
    .filter((char) => /[A-Za-z0-9]/.test(char))
    .join('')

  return normalized.length > 0 ? normalized : 'App'
}

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

const BY_CODE: Readonly<Record<number, ErrorCode>> = {
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

const MESSAGE_PATTERNS: readonly (readonly [RegExp, ErrorCode])[] = [
  [
    /too many certificates|maximum number of certificates|current .*certificate or a pending/i,
    ErrorCode.CertificateLimit
  ],
  [
    /maximum number of (registered )?app ids|not enough available app ids/i,
    ErrorCode.AppIdQuotaExceeded
  ]
]

export const developerErrorCode = (
  resultCode: number,
  message = ''
): ErrorCode => {
  const byCode = BY_CODE[resultCode]
  if (byCode) return byCode
  for (const [pattern, code] of MESSAGE_PATTERNS)
    if (pattern.test(message)) return code
  return ErrorCode.DeveloperRequestFailed
}

export type AppIdPlan = {
  /** Identifiers that already exist on the team (reused, no quota). */
  readonly reuse: readonly AppId[]
  /** Identifiers that must be created. */
  readonly create: readonly string[]
  readonly available: number
  readonly enough: boolean
  /** When the earliest existing App ID expires (frees a slot), if known. */
  readonly nextSlotAt?: Date
}

/** Budgets App IDs before any write: what can be reused, what must be created, and whether the quota allows it. */
export const planAppIds = (
  wanted: readonly string[],
  existing: readonly AppId[],
  quota: AppIdQuota,
  now: Date
): AppIdPlan => {
  const byIdentifier = new Map(
    existing.map((appId) => [appId.identifier, appId])
  )
  const reuse = wanted.flatMap((identifier) => {
    const found = byIdentifier.get(identifier)

    return found ? [found] : []
  })
  const create = [
    ...new Set(wanted.filter((identifier) => !byIdentifier.has(identifier)))
  ]
  const nextSlotAt = existing
    .map((appId) => appId.expiresAt)
    .filter(
      (date): date is Date =>
        date !== undefined && date.getTime() > now.getTime()
    )
    .sort((a, b) => a.getTime() - b.getTime())[0]

  return compact({
    reuse,
    create,
    available: quota.available,
    enough: create.length <= quota.available,
    nextSlotAt
  })
}

/** True when `certificate` is an iOS development certificate that has not expired. */
export const isUsableCertificate = (
  certificate: DevelopmentCertificate,
  now: Date
): boolean =>
  (certificate.platform === undefined ||
    certificate.platform.toLowerCase() === 'ios') &&
  (certificate.expiresAt === undefined ||
    certificate.expiresAt.getTime() > now.getTime()) &&
  (certificate.status === undefined ||
    certificate.status.toLowerCase() !== 'revoked')

// Apple developer-account resources as IPAForge uses them, plus the rules that keep free accounts within Apple's
// limits (10 App IDs per 7 days, few development certificates).

import {
  DEVELOPER_ERROR_BY_CODE,
  DEVELOPER_MESSAGE_PATTERNS
} from '@apple/domain/constants.ts'
import type {
  AppId,
  AppIdPlan,
  AppIdQuota,
  DevelopmentCertificate
} from '@apple/domain/types.ts'
import { compact, ErrorCode } from '@ipaforge/kernel'

/** Feature flag that enables App Groups on an App ID. */
export const APP_GROUPS_FEATURE = 'APG3427HIY'

/** Apple accepts only ASCII letters and digits in App ID and group names, and never an empty name. */
export const normalizeAppIdName = (name: string): string => {
  const normalized = [...name]
    .filter((char) => /[A-Za-z0-9]/.test(char))
    .join('')

  return normalized.length > 0 ? normalized : 'App'
}

export const developerErrorCode = (
  resultCode: number,
  message = ''
): ErrorCode => {
  const byCode = DEVELOPER_ERROR_BY_CODE[resultCode]
  if (byCode) return byCode
  for (const [pattern, code] of DEVELOPER_MESSAGE_PATTERNS)
    if (pattern.test(message)) return code
  return ErrorCode.DeveloperRequestFailed
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
    nextSlotAt,
    isUnreliable: quota.isUnreliable
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

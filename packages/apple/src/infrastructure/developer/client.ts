// Apple's developer services (the API Xcode uses for free and paid accounts): XML-plist requests authenticated
// with the Xcode app token, fresh anisette values on every request, `resultCode` 0 for success.

import { developerErrorCode } from '@apple/domain/developer.ts'
import type { AnisetteData } from '@apple/domain/types.ts'
import { nonEmpty } from '@apple/domain/values.ts'
import {
  appleHeaders,
  PLIST_HEADERS,
  pickHeaders
} from '@apple/infrastructure/apple-headers.ts'
import type {
  DeveloperAuth,
  DeveloperFields,
  DeveloperPlatform,
  DeveloperRequestOptions
} from '@apple/infrastructure/developer/types.ts'
import { fetchApple, successOr } from '@apple/infrastructure/http.ts'
import { parseApplePlist } from '@apple/infrastructure/plist-diagnostics.ts'
import { plistNumber } from '@apple/infrastructure/plist-fields.ts'
import type { FetchResult } from '@apple/infrastructure/types.ts'
import type { AppleDeps } from '@apple/types.ts'
import {
  compact,
  createDict,
  ErrorCode,
  IPAForgeError,
  isPlistDict,
  type PlistDict,
  serializeXmlPlist,
  stringAt
} from '@ipaforge/kernel'

export const DEVELOPER_BASE =
  'https://developerservices2.apple.com/services/QH65B2/'
export const DEVELOPER_CLIENT_ID = 'XABBG36SBA'
export const DEVELOPER_PROTOCOL = 'QH65B2'

const HTTP_UNAUTHORIZED = 401
const HTTP_FORBIDDEN = 403

export const developerUrl = (
  action: string,
  platform: DeveloperPlatform
): string =>
  `${DEVELOPER_BASE}${platform === 'ios' ? 'ios/' : ''}${action}.action?clientId=${DEVELOPER_CLIENT_ID}`

const requestHeaders = (
  deps: AppleDeps,
  anisette: AnisetteData,
  auth: DeveloperAuth
): Record<string, string> => ({
  ...appleHeaders(deps, anisette),
  ...pickHeaders(anisette.headers, deps.config.cpdAnisetteHeaders),
  ...PLIST_HEADERS,
  'X-Apple-GS-Token': auth.token,
  'X-Apple-I-Identity-Id': auth.adsid
})

const requestBody = (deps: AppleDeps, fields: DeveloperFields): PlistDict =>
  createDict([
    ['clientId', DEVELOPER_CLIENT_ID],
    ['protocolVersion', DEVELOPER_PROTOCOL],
    ['requestId', globalThis.crypto.randomUUID().toUpperCase()],
    ['userLocale', [deps.config.locale]],
    ...fields
  ])

/** 401 means the app token expired; 403 on `listTeams` means the Apple ID cannot use developer services. */
const assertAuthorized = (response: FetchResult, action: string): void => {
  if (response.status === HTTP_UNAUTHORIZED)
    throw new IPAForgeError(ErrorCode.SessionExpired, { data: { action } })
  if (response.status !== HTTP_FORBIDDEN) return
  throw new IPAForgeError(
    action === 'listTeams'
      ? ErrorCode.NotEligibleForDevelopment
      : ErrorCode.DeveloperRequestFailed,
    {
      message: `developer services refused ${action} (HTTP 403)`,
      data: { action, status: HTTP_FORBIDDEN }
    }
  )
}

/** Throws the catalogued error for a non-zero `resultCode`. */
const assertResultOk = (
  deps: AppleDeps,
  value: PlistDict,
  action: string
): void => {
  const resultCode = plistNumber(value.resultCode) ?? 0
  if (resultCode === 0) return
  deps.logger.info('developer request failed', {
    request: 'developer',
    action,
    resultCode
  })
  const message =
    stringAt(value, 'userString') ?? stringAt(value, 'resultString') ?? ''
  throw new IPAForgeError(developerErrorCode(resultCode, message), {
    message: `${action} failed: ${resultCode} ${message}`.trim(),
    data: compact({ action, resultCode, appleMessage: nonEmpty(message) })
  })
}

/** Sends one developer-API request and returns the response dict (throws a catalogued error on resultCode ≠ 0). */
export const developerRequest = async (
  deps: AppleDeps,
  options: DeveloperRequestOptions,
  action: string,
  platform: DeveloperPlatform,
  fields: DeveloperFields = []
): Promise<PlistDict> => {
  const [anisette, auth] = await Promise.all([
    options.anisette(),
    options.auth()
  ])
  const body = requestBody(deps, fields)
  deps.logger.debug('developer request', {
    action,
    fields: fields.map(([key]) => key)
  })
  const response = await fetchApple(deps, developerUrl(action, platform), {
    method: 'POST',
    headers: requestHeaders(deps, anisette, auth),
    body: serializeXmlPlist(body),
    acceptStatus: successOr(HTTP_UNAUTHORIZED, HTTP_FORBIDDEN)
  })
  if (response.status === HTTP_UNAUTHORIZED)
    deps.logger.info('developer services refused the app token', {
      request: 'developer',
      action,
      httpStatus: response.status
    })
  assertAuthorized(response, action)
  const value = parseApplePlist(response.body, `developer ${action}`)
  if (!isPlistDict(value))
    throw new IPAForgeError(ErrorCode.AppleProtocolError, {
      message: `${action}: not a dict`
    })
  assertResultOk(deps, value, action)
  return value
}

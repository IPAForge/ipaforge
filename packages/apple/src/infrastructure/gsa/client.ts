// GrandSlam (GsService2): plist requests carrying the client-provided data (`cpd`) built from anisette.

import type { AppleDeps } from '@apple/deps.ts'
import type { AnisetteData } from '@apple/domain/anisette.ts'
import type { GsaStatus } from '@apple/domain/gsa-status.ts'
import { nonEmpty } from '@apple/domain/values.ts'
import {
  appleHeaders,
  PLIST_HEADERS,
  pickHeaders
} from '@apple/infrastructure/apple-headers.ts'
import { bagUrl } from '@apple/infrastructure/gsa/url-bag.ts'
import { fetchApple } from '@apple/infrastructure/http.ts'
import { parseApplePlist } from '@apple/infrastructure/plist-diagnostics.ts'
import { plistNumber } from '@apple/infrastructure/plist-fields.ts'
import {
  compact,
  createDict,
  ErrorCode,
  isPlistDict,
  LoadstarError,
  type PlistDict,
  type PlistValue,
  serializeXmlPlist,
  stringAt,
  toBase64
} from '@loadstar/kernel'

/** `Header.Version` of every GsService2 request. */
const GSA_PROTOCOL_VERSION = '1.0.1'

/** `cpd`: the anisette headers plus the flags an Apple client sends with every GrandSlam request. */
export const clientProvidedData = (
  deps: AppleDeps,
  anisette: AnisetteData
): PlistDict =>
  createDict([
    // Apple's own clients send these flags as strings.
    ['bootstrap', 'true'],
    ['icscrec', 'true'],
    ['loc', deps.config.locale],
    ['pbe', 'false'],
    ['prkgen', 'true'],
    ['svct', 'iCloud'],
    ...Object.entries(
      pickHeaders(anisette.headers, deps.config.cpdAnisetteHeaders)
    )
  ])

/** `X-Apple-I-MD-DATA` as base64, whichever way Apple encoded it. */
const resyncDataOf = (value: PlistValue | undefined): string | undefined => {
  if (value instanceof Uint8Array) return toBase64(value)
  return typeof value === 'string' ? value : undefined
}

export const statusOf = (response: PlistDict): GsaStatus => {
  const status = isPlistDict(response.Status) ? response.Status : createDict()

  return compact({
    ec: plistNumber(status.ec) ?? 0,
    em: stringAt(status, 'em'),
    hsc: plistNumber(status.hsc),
    au: stringAt(status, 'au'),
    resyncData: nonEmpty(resyncDataOf(status['X-Apple-I-MD-DATA']))
  })
}

export type GsaResponse = {
  readonly response: PlistDict
  readonly status: GsaStatus
  readonly clockSkewMs?: number
}

/** Shape of the request (names and non-secret values only), for comparing with clients Apple accepts. */
const logRequestShape = (
  deps: AppleDeps,
  request: PlistDict,
  headers: Record<string, string>
): void =>
  deps.logger.debug('GSA request', {
    operation: request.o,
    headers: Object.keys(headers),
    clientInfo: headers['X-Mme-Client-Info'],
    userAgent: headers['User-Agent'],
    requestFields: Object.keys(request),
    cpdFields: isPlistDict(request.cpd) ? Object.keys(request.cpd) : []
  })

const envelope = (request: PlistDict): Uint8Array =>
  serializeXmlPlist(
    createDict([
      ['Header', createDict([['Version', GSA_PROTOCOL_VERSION]])],
      ['Request', request]
    ])
  )

/** POSTs `{ Header: { Version }, Request }` to GsService2 and returns `Response` with its status. */
export const gsaRequest = async (
  deps: AppleDeps,
  anisette: AnisetteData,
  request: PlistDict,
  options: {
    readonly retryTransient?: boolean
    readonly signal?: AbortSignal
  } = {}
): Promise<GsaResponse> => {
  const headers = { ...appleHeaders(deps, anisette), ...PLIST_HEADERS }
  logRequestShape(deps, request, headers)
  const result = await fetchApple(
    deps,
    await bagUrl(deps, 'gsService', deps.config.endpoints.gsaService),
    compact({
      method: 'POST' as const,
      headers,
      body: envelope(request),
      retryTransient: options.retryTransient ?? true,
      signal: options.signal
    })
  )
  const value = parseApplePlist(
    result.body,
    `GSA ${String(request.o)} response`
  )
  const response =
    isPlistDict(value) && isPlistDict(value.Response)
      ? value.Response
      : undefined
  if (!response)
    throw new LoadstarError(ErrorCode.AppleProtocolError, {
      message: 'GSA answered without a Response'
    })
  return compact({
    response,
    status: statusOf(response),
    clockSkewMs: result.clockSkewMs
  })
}

// HTTP for Apple and anisette endpoints: per-request timeout, retries for transient failures only,
// and clock-skew detection from the `Date` header.

import type { AppleDeps } from '@apple/deps.ts'
import { httpErrorCode } from '@apple/domain/gsa-status.ts'
import {
  compact,
  ErrorCode,
  type HttpMethod,
  type HttpResponse,
  isTransientHttpStatus,
  LoadstarError,
  readBody,
  retry,
  utf8DecodeLenient
} from '@loadstar/kernel'

export type FetchOptions = {
  readonly method?: HttpMethod
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: Uint8Array | string
  readonly timeoutMs?: number
  /** Retry 429/5xx/network failures (default true). Never set for requests carrying a password check. */
  readonly retryTransient?: boolean
  /** Accept these statuses without throwing (default: 2xx only). */
  readonly acceptStatus?: (status: number) => boolean
  readonly signal?: AbortSignal
  readonly maxBodyBytes?: number
}

export type FetchResult = {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body: Uint8Array
  /** Server clock minus local clock, when the server sent a `Date` header. */
  readonly clockSkewMs?: number
}

/** Bytes of an unexpected response body kept in the error, for diagnosis. */
const ERROR_BODY_PREVIEW_BYTES = 512
const DEFAULT_METHOD: HttpMethod = 'GET'

export const isSuccessStatus = (status: number): boolean =>
  status >= 200 && status < 300

/** An `acceptStatus` that takes 2xx plus the listed statuses. */
export const successOr =
  (...statuses: readonly number[]) =>
  (status: number): boolean =>
    isSuccessStatus(status) || statuses.includes(status)

class TransientHttpError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

/** Rate limits, temporary server failures, timeouts and network drops (adapters report those as `net.offline`). */
const isTransient = (error: unknown): boolean =>
  error instanceof TransientHttpError ||
  (error instanceof LoadstarError && error.code === ErrorCode.Offline) ||
  (error instanceof Error && error.name === 'TimeoutError')

const headerValue = (
  headers: Readonly<Record<string, string>>,
  name: string
): string | undefined => {
  const wanted = name.toLowerCase()
  for (const [key, value] of Object.entries(headers))
    if (key.toLowerCase() === wanted) return value
  return undefined
}

const hostOf = (url: string): string => new URL(url).host

/** Server clock minus local clock, from the response's `Date` header. */
const clockSkewOf = (
  deps: AppleDeps,
  response: HttpResponse
): number | undefined => {
  const date = headerValue(response.headers, 'date')
  const serverTime = date ? Date.parse(date) : Number.NaN

  return Number.isFinite(serverTime)
    ? serverTime - deps.clock.now().getTime()
    : undefined
}

const rejectedStatusError = (
  url: string,
  method: HttpMethod,
  status: number,
  body: Uint8Array
): LoadstarError => {
  const target = new URL(url)

  return new LoadstarError(httpErrorCode(status), {
    message: `${method} ${target.host}${target.pathname} → HTTP ${status}`,
    data: {
      status,
      host: target.host,
      body: utf8DecodeLenient(body.subarray(0, ERROR_BODY_PREVIEW_BYTES))
    }
  })
}

/** One request with its own timeout; throws `TransientHttpError` for statuses worth retrying. */
const fetchOnce = async (
  deps: AppleDeps,
  url: string,
  options: FetchOptions,
  timeoutMs: number,
  accept: (status: number) => boolean
): Promise<FetchResult> => {
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout
  const method = options.method ?? DEFAULT_METHOD
  const response = await deps.http.request(
    compact({
      method,
      url,
      signal,
      headers: options.headers,
      body: options.body
    })
  )
  const body = await readBody(response, options.maxBodyBytes)
  if (!accept(response.status)) {
    if (isTransientHttpStatus(response.status))
      throw new TransientHttpError(response.status)
    throw rejectedStatusError(url, method, response.status, body)
  }
  return compact({
    status: response.status,
    headers: response.headers,
    body,
    clockSkewMs: clockSkewOf(deps, response)
  })
}

/** What a failure that survived the retries becomes: always a catalogued `LoadstarError`. */
const toFetchError = (url: string, error: unknown): LoadstarError => {
  if (error instanceof TransientHttpError) {
    return new LoadstarError(httpErrorCode(error.status), {
      message: `${hostOf(url)} answered HTTP ${error.status}`,
      data: { status: error.status, host: hostOf(url) }
    })
  }
  if (error instanceof LoadstarError) return error
  return new LoadstarError(ErrorCode.Offline, {
    cause: error,
    data: { host: hostOf(url) }
  })
}

export const fetchApple = async (
  deps: AppleDeps,
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> => {
  const accept = options.acceptStatus ?? isSuccessStatus
  const timeoutMs = options.timeoutMs ?? deps.config.timeouts.requestMs
  try {
    return await retry(
      () => fetchOnce(deps, url, options, timeoutMs, accept),
      compact({
        attempts:
          options.retryTransient === false ? 1 : deps.config.retryAttempts,
        retryOn: isTransient,
        sleep: deps.sleep,
        random: deps.random,
        onRetry: (error: unknown, n: number, delayMs: number) =>
          deps.logger.warn('retrying request', {
            host: hostOf(url),
            attempt: n,
            delayMs,
            cause: error
          }),
        signal: options.signal
      })
    )
  } catch (error) {
    throw toFetchError(url, error)
  }
}

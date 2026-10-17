import type { HttpMethod } from '@loadstar/kernel'

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

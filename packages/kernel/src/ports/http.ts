import { concatBytes } from '@kernel/bytes/bytes.ts'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

export type HttpRequest = {
  readonly method: HttpMethod
  readonly url: string
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: Uint8Array | string
  readonly signal?: AbortSignal
}

export type HttpResponse = {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  /** The body as a stream; use the `readBody` helper to buffer it when small. */
  readonly body: ReadableStream<Uint8Array>
}

/**
 * Outbound HTTP, straight to the internet (Apple, GitHub, anisette servers). Implementations reject with `LoadstarError("net.offline")` when there is no network.
 */
export type HttpClient = {
  request(request: HttpRequest): Promise<HttpResponse>
}

/** Largest body `readBody` buffers by default. */
const DEFAULT_BODY_LIMIT = 32 * 1024 * 1024

/** Buffer a response body, refusing bodies larger than `limit` bytes. */
export const readBody = async (
  response: HttpResponse,
  limit = DEFAULT_BODY_LIMIT
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = []
  let total = 0
  const reader = response.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > limit)
        throw new RangeError(`response body exceeds ${limit} bytes`)
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return concatBytes(chunks)
}

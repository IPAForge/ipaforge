import { concatBytes } from '@kernel/bytes/bytes.ts'
import type { HttpResponse } from '@kernel/ports/types.ts'

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

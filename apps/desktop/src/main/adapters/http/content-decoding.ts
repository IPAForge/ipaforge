import type { IncomingMessage } from 'node:http'
import type { Readable, Transform } from 'node:stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'

const DECODERS: Readonly<Record<string, () => Transform>> = {
  gzip: createGunzip,
  'x-gzip': createGunzip,
  deflate: createInflate,
  br: createBrotliDecompress
}

/**
 * Some Apple endpoints compress responses even when the request did not ask for it. Decompress gzip/deflate/br
 * here so callers always see the plain body (and drop the header that no longer applies).
 */
export const decoded = (
  message: IncomingMessage,
  headers: Record<string, string>
): Readable => {
  const encoding = (headers['content-encoding'] ?? '').trim().toLowerCase()
  const decoder = Object.hasOwn(DECODERS, encoding)
    ? DECODERS[encoding]?.()
    : undefined
  if (!decoder) return message
  delete headers['content-encoding']
  delete headers['content-length']
  message.on('error', (error) => decoder.destroy(error))
  return message.pipe(decoder)
}

import type { Connection } from '@device/domain/ports/transport.ts'
import { ErrorCode, LoadstarError } from '@loadstar/kernel'

/** Exact-length reads over a chunked connection. */
export type StreamReader = {
  readExact(length: number): Promise<Uint8Array>
  /** Bytes received but not yet consumed (must be 0 before a TLS upgrade). */
  readonly buffered: number
}

export const createStreamReader = (connection: Connection): StreamReader => {
  const chunks: Uint8Array[] = []
  let buffered = 0

  const fill = async (length: number): Promise<void> => {
    while (buffered < length) {
      const chunk = await connection.read()
      if (chunk === null) {
        throw new LoadstarError(ErrorCode.DeviceDisconnected, {
          message: `connection closed with ${buffered} of ${length} bytes received`
        })
      }
      if (chunk.byteLength === 0) continue
      chunks.push(chunk)
      buffered += chunk.byteLength
    }
  }

  const take = (length: number): Uint8Array => {
    const out = new Uint8Array(length)
    let offset = 0
    while (offset < length) {
      const head = chunks[0] as Uint8Array
      const needed = length - offset
      if (head.byteLength <= needed) {
        out.set(head, offset)
        offset += head.byteLength
        chunks.shift()
      } else {
        out.set(head.subarray(0, needed), offset)
        chunks[0] = head.subarray(needed)
        offset += needed
      }
    }
    buffered -= length
    return out
  }

  return {
    readExact: async (length) => {
      if (length === 0) return new Uint8Array()
      await fill(length)
      return take(length)
    },
    get buffered() {
      return buffered
    }
  }
}

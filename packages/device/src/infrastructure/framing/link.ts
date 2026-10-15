import type {
  Connection,
  TlsCredentials
} from '@device/domain/ports/transport.ts'
import {
  createStreamReader,
  type StreamReader
} from '@device/infrastructure/framing/stream-reader.ts'
import { ErrorCode, LoadstarError } from '@loadstar/kernel'

/** A connection plus its read buffer. Protocols that switch framing mid-stream (house_arrest → AFC) share it. */
export type Link = {
  readonly reader: StreamReader
  write(bytes: Uint8Array): Promise<void>
  startTls(credentials: TlsCredentials): Promise<void>
  close(): Promise<void>
}

export const createLink = (connection: Connection): Link => {
  const reader = createStreamReader(connection)
  let closed = false

  return {
    reader,
    write: (bytes) => connection.write(bytes),
    startTls: async (credentials) => {
      if (reader.buffered > 0) {
        throw new LoadstarError(ErrorCode.DeviceProtocolError, {
          message: `${reader.buffered} unread bytes before the TLS upgrade`
        })
      }
      await connection.startTls(credentials)
    },
    close: async () => {
      if (closed) return
      closed = true
      await connection.close()
    }
  }
}

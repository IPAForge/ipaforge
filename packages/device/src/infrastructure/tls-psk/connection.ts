// A TLS 1.2 PSK connection over another `Connection`, as a `Connection` itself: what the remote pairing tunnel runs
// on. iOS refuses the PSK cipher suites of Electron's TLS library (the SHA-1 ones), so this is IPAForge's own,
// with the one suite iOS takes: TLS_PSK_WITH_AES_128_GCM_SHA256.
import type { Connection } from '@device/domain/ports/types.ts'
import {
  AlertDescription,
  ContentType,
  MAX_FRAGMENT_BYTES
} from '@device/infrastructure/tls-psk/constants.ts'
import { handshake } from '@device/infrastructure/tls-psk/handshake.ts'
import {
  createRecordReader,
  openRecord,
  sealRecord,
  tlsError
} from '@device/infrastructure/tls-psk/records.ts'

export type TlsPskOptions = {
  readonly psk: Uint8Array
  readonly randomBytes: (length: number) => Uint8Array
}

/** Runs the handshake over `connection` and returns the protected connection; throws when the server refuses. */
export const connectTlsPsk = async (
  connection: Connection,
  { psk, randomBytes }: TlsPskOptions
): Promise<Connection> => {
  const readRecord = createRecordReader(connection)
  const keys = await handshake(
    { readRecord, write: (bytes) => connection.write(bytes), randomBytes },
    psk
  )
  let isClosed = false

  return {
    read: async () => {
      for (;;) {
        const record = await readRecord()
        if (!record) return null
        const plain = openRecord(keys.receive, record)
        if (record.type === ContentType.ApplicationData) {
          if (plain.length > 0) return plain
          continue
        }
        if (record.type === ContentType.Alert) {
          if (plain[1] === AlertDescription.CloseNotify) return null
          throw tlsError('the server sent an alert', {
            level: plain[0],
            description: plain[1]
          })
        }
        throw tlsError('an unexpected record', { type: record.type })
      }
    },
    write: async (bytes) => {
      for (let start = 0; start < bytes.length; start += MAX_FRAGMENT_BYTES)
        await connection.write(
          sealRecord(
            keys.send,
            ContentType.ApplicationData,
            bytes.subarray(start, start + MAX_FRAGMENT_BYTES)
          )
        )
    },
    startTls: async () => {
      throw tlsError('already a TLS connection')
    },
    close: async () => {
      if (isClosed) return
      isClosed = true
      try {
        await connection.write(
          sealRecord(
            keys.send,
            ContentType.Alert,
            new Uint8Array([1, AlertDescription.CloseNotify])
          )
        )
      } catch {
        // The other side may be gone already; closing goes on.
      }
      await connection.close()
    }
  }
}

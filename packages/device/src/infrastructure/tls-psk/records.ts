// TLS 1.2 records: reading them from a connection, and AES-128-GCM protection once ChangeCipherSpec is done
// (RFC 5288: nonce = 4-byte fixed IV + 8-byte explicit nonce, additional data = sequence, type, version, length).
import { gcm } from '@noble/ciphers/aes.js'

import type { Connection } from '@device/domain/ports/types.ts'
import { createStreamReader } from '@device/infrastructure/framing/stream-reader.ts'
import {
  EXPLICIT_NONCE_BYTES,
  MAX_RECORD_BYTES,
  RECORD_HEADER_BYTES,
  TAG_BYTES,
  TLS_1_2
} from '@device/infrastructure/tls-psk/constants.ts'
import type {
  RecordKeys,
  TlsRecord
} from '@device/infrastructure/tls-psk/types.ts'
import {
  ByteWriter,
  concatBytes,
  ErrorCode,
  IPAForgeError
} from '@ipaforge/kernel'

export const tlsError = (message: string, data?: Record<string, unknown>) =>
  new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: `TLS-PSK: ${message}`,
    ...(data ? { data } : {})
  })

export const encodeRecord = (type: number, fragment: Uint8Array): Uint8Array =>
  new ByteWriter()
    .u8(type)
    .u16be(TLS_1_2)
    .u16be(fragment.length)
    .bytes(fragment)
    .toBytes()

/** Reads whole records from `connection`; `null` once it ends between records. */
export const createRecordReader = (connection: Connection) => {
  const reader = createStreamReader(connection)

  return async (): Promise<TlsRecord | null> => {
    let header: Uint8Array
    try {
      header = await reader.readExact(RECORD_HEADER_BYTES)
    } catch (error) {
      if (
        error instanceof IPAForgeError &&
        error.code === ErrorCode.DeviceDisconnected
      )
        return null
      throw error
    }
    const view = new DataView(header.buffer, header.byteOffset)
    const length = view.getUint16(3)
    if (length > MAX_RECORD_BYTES)
      throw tlsError('a record too large', { length })

    return { type: header[0] ?? 0, fragment: await reader.readExact(length) }
  }
}

const additionalData = (sequence: bigint, type: number, length: number) =>
  new ByteWriter()
    .u64be(sequence)
    .u8(type)
    .u16be(TLS_1_2)
    .u16be(length)
    .toBytes()

export const sealRecord = (
  keys: RecordKeys,
  type: number,
  plain: Uint8Array
): Uint8Array => {
  const explicit = new ByteWriter().u64be(keys.sequence).toBytes()
  const nonce = concatBytes([keys.fixedIv, explicit])
  const sealed = gcm(
    keys.key,
    nonce,
    additionalData(keys.sequence, type, plain.length)
  ).encrypt(plain)
  keys.sequence += 1n

  return encodeRecord(type, concatBytes([explicit, sealed]))
}

export const openRecord = (keys: RecordKeys, record: TlsRecord): Uint8Array => {
  const { fragment, type } = record
  if (fragment.length < EXPLICIT_NONCE_BYTES + TAG_BYTES)
    throw tlsError('a record too short to open')
  const nonce = concatBytes([
    keys.fixedIv,
    fragment.subarray(0, EXPLICIT_NONCE_BYTES)
  ])
  const sealed = fragment.subarray(EXPLICIT_NONCE_BYTES)
  const length = sealed.length - TAG_BYTES
  let plain: Uint8Array
  try {
    plain = gcm(
      keys.key,
      nonce,
      additionalData(keys.sequence, type, length)
    ).decrypt(sealed)
  } catch {
    throw tlsError(
      "a record that doesn't open (wrong key, or changed on the way)"
    )
  }
  keys.sequence += 1n

  return plain
}

import {
  AFC_HEADER_SIZE,
  AFC_MAGIC,
  AFC_U64_SIZE
} from '@device/infrastructure/afc/constants.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  ByteWriter,
  concatBytes,
  ErrorCode,
  equalBytes,
  LoadstarError,
  utf8Decode
} from '@loadstar/kernel'

export type AfcPacket = {
  readonly operation: number
  readonly packetNumber: bigint
  /** Operation arguments (between the header and `this length`). */
  readonly header: Uint8Array
  /** Bulk data (after `this length`). */
  readonly data: Uint8Array
}

export const encodeAfcPacket = (packet: AfcPacket): Uint8Array => {
  const thisLength = AFC_HEADER_SIZE + packet.header.byteLength
  const entireLength = thisLength + packet.data.byteLength

  return new ByteWriter(entireLength)
    .bytes(AFC_MAGIC)
    .u64le(BigInt(entireLength))
    .u64le(BigInt(thisLength))
    .u64le(packet.packetNumber)
    .u64le(BigInt(packet.operation))
    .bytes(packet.header)
    .bytes(packet.data)
    .toBytes()
}

export const readAfcPacket = async (
  link: Link,
  maxBytes: number
): Promise<AfcPacket> => {
  const fixed = await link.reader.readExact(AFC_HEADER_SIZE)
  if (!equalBytes(fixed.subarray(0, AFC_MAGIC.byteLength), AFC_MAGIC)) {
    throw new LoadstarError(ErrorCode.AfcError, { message: 'bad AFC magic' })
  }
  const view = new DataView(fixed.buffer, fixed.byteOffset, fixed.byteLength)
  const entireLength = view.getBigUint64(8, true)
  const thisLength = view.getBigUint64(16, true)
  const packetNumber = view.getBigUint64(24, true)
  const operation = Number(view.getBigUint64(32, true))
  if (
    thisLength < AFC_HEADER_SIZE ||
    entireLength < thisLength ||
    entireLength > BigInt(maxBytes)
  ) {
    throw new LoadstarError(ErrorCode.AfcError, {
      message: `invalid AFC lengths (entire ${entireLength}, this ${thisLength})`
    })
  }
  const header = await link.reader.readExact(
    Number(thisLength) - AFC_HEADER_SIZE
  )
  const data = await link.reader.readExact(Number(entireLength - thisLength))

  return { operation, packetNumber, header, data }
}

/** Devices put response payloads in either part; callers read them as one. */
export const payloadOf = (packet: AfcPacket): Uint8Array =>
  packet.header.byteLength === 0
    ? packet.data
    : concatBytes([packet.header, packet.data])

/** NUL-terminated strings (directory listings, key/value file info). Empty values are kept so pairs stay aligned. */
export const splitCStrings = (bytes: Uint8Array): string[] => {
  const parts = utf8Decode(bytes).split('\0')
  if (parts.at(-1) === '') parts.pop()
  return parts
}

/** Key/value pairs from alternating NUL-terminated strings (file info, device info). */
export const keyValues = (
  strings: readonly string[]
): Record<string, string> => {
  const out: Record<string, string> = Object.create(null)
  for (let i = 0; i + 1 < strings.length; i += 2)
    out[strings[i] as string] = strings[i + 1] as string
  return out
}

/** A NUL-terminated UTF-8 string (paths in request headers). */
export const cstring = (text: string): Uint8Array =>
  new ByteWriter().cstring(text).toBytes()

/** A little-endian u64 (file handles in request headers). */
export const u64 = (value: bigint): Uint8Array =>
  new ByteWriter(AFC_U64_SIZE).u64le(value).toBytes()

/** The little-endian u64 at the start of a payload, or `undefined` when the payload is too short. */
export const readU64 = (payload: Uint8Array): bigint | undefined =>
  payload.byteLength >= AFC_U64_SIZE
    ? new DataView(payload.buffer, payload.byteOffset).getBigUint64(0, true)
    : undefined

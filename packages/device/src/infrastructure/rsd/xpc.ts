// The binary XPC object format and the message wrapper RemoteXPC sends it in. Everything is little-endian, and
// every object starts on a 4-byte boundary: a u32 type tag, then its value (strings, data and dictionary keys are
// padded with zeros to the next boundary).
import {
  XPC_OBJECT_MAGIC,
  XPC_OBJECT_VERSION,
  XPC_UUID_BYTES,
  XPC_WRAPPER_BYTES,
  XPC_WRAPPER_MAGIC,
  XpcType
} from '@device/infrastructure/rsd/constants.ts'
import type {
  XpcDictionary,
  XpcMessage,
  XpcValue
} from '@device/infrastructure/rsd/types.ts'
import { XpcUuid } from '@device/infrastructure/rsd/xpc-uuid.ts'
import {
  ByteReader,
  ByteWriter,
  concatBytes,
  ErrorCode,
  IPAForgeError,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

/** Deepest nesting of arrays and dictionaries accepted from the device. */
const MAX_DEPTH = 64
const NANOSECONDS_PER_MS = 1_000_000n

const malformed = (message: string, cause?: unknown) =>
  new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: `XPC: ${message}`,
    ...(cause === undefined ? {} : { cause })
  })

export const isXpcDictionary = (value: XpcValue): value is XpcDictionary =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Uint8Array) &&
  !(value instanceof Date) &&
  !(value instanceof XpcUuid)

const eightBytes = (set: (view: DataView) => void): Uint8Array => {
  const bytes = new Uint8Array(8)
  set(new DataView(bytes.buffer))
  return bytes
}

/** A length-prefixed, zero-padded run of bytes (strings and data). */
const writePadded = (writer: ByteWriter, bytes: Uint8Array): void => {
  writer.bytes(bytes).align(4)
}

const writeNumber = (writer: ByteWriter, value: number): void => {
  if (Number.isInteger(value)) {
    if (!Number.isSafeInteger(value))
      throw malformed(`${value} is not a safe integer`)
    writer
      .u32le(XpcType.Int64)
      .bytes(eightBytes((view) => view.setBigInt64(0, BigInt(value), true)))
    return
  }
  writer
    .u32le(XpcType.Double)
    .bytes(eightBytes((view) => view.setFloat64(0, value, true)))
}

/** A container: its type, the byte length of what follows, the item count, then the items. */
const writeContainer = (
  writer: ByteWriter,
  type: number,
  count: number,
  items: ByteWriter
): void => {
  const body = items.toBytes()
  writer
    .u32le(type)
    .u32le(body.length + 4)
    .u32le(count)
    .bytes(body)
}

const writeString = (writer: ByteWriter, value: string): void => {
  const bytes = utf8Encode(value)
  writer.u32le(XpcType.String).u32le(bytes.length + 1)
  writePadded(writer, concatBytes([bytes, new Uint8Array(1)]))
}

/** Null, booleans, numbers and strings; `false` for anything else. */
const writeScalar = (writer: ByteWriter, value: XpcValue): boolean => {
  if (value === null) writer.u32le(XpcType.Null)
  else if (typeof value === 'boolean')
    writer
      .u32le(XpcType.Bool)
      .u8(value ? 1 : 0)
      .align(4)
  else if (typeof value === 'number') writeNumber(writer, value)
  else if (typeof value === 'bigint') writer.u32le(XpcType.Uint64).u64le(value)
  else if (typeof value === 'string') writeString(writer, value)
  else return false
  return true
}

const writeDate = (writer: ByteWriter, value: Date): void => {
  writer
    .u32le(XpcType.Date)
    .bytes(
      eightBytes((view) =>
        view.setBigInt64(0, BigInt(value.getTime()) * NANOSECONDS_PER_MS, true)
      )
    )
}

const writeDictionary = (writer: ByteWriter, value: XpcDictionary): void => {
  const entries = Object.entries(value)
  const items = new ByteWriter()
  for (const [key, item] of entries) {
    items.cstring(key).align(4)
    writeObject(items, item)
  }
  writeContainer(writer, XpcType.Dictionary, entries.length, items)
}

const writeObject = (writer: ByteWriter, value: XpcValue): void => {
  if (writeScalar(writer, value)) return
  if (value instanceof Uint8Array) {
    writer.u32le(XpcType.Data).u32le(value.length)
    writePadded(writer, value)
  } else if (value instanceof Date) writeDate(writer, value)
  else if (value instanceof XpcUuid)
    writer.u32le(XpcType.Uuid).bytes(value.bytes)
  else if (Array.isArray(value)) {
    const items = new ByteWriter()
    for (const item of value) writeObject(items, item)
    writeContainer(writer, XpcType.Array, value.length, items)
  } else if (isXpcDictionary(value)) writeDictionary(writer, value)
}

/** A message body: the object magic and version, then `value`. */
export const encodeXpcBody = (value: XpcValue): Uint8Array => {
  const writer = new ByteWriter()
  writer.u32le(XPC_OBJECT_MAGIC).u32le(XPC_OBJECT_VERSION)
  writeObject(writer, value)

  return writer.toBytes()
}

/** Reads `count` items of a container, checking first that they could fit in what is left. */
const readCount = (reader: ByteReader): number => {
  reader.u32le() // the container's byte length: the items say where they end
  const count = reader.u32le()
  if (count > reader.remaining / 4)
    throw malformed(`${count} items cannot fit in ${reader.remaining} bytes`)
  return count
}

const readPaddedBytes = (reader: ByteReader, length: number): Uint8Array => {
  const bytes = reader.bytes(length).slice()
  reader.align(4)
  return bytes
}

const readString = (reader: ByteReader): string => {
  const length = reader.u32le()
  if (length === 0) throw malformed('a string without its terminator')
  return utf8Decode(readPaddedBytes(reader, length).subarray(0, length - 1))
}

const readInt64 = (reader: ByteReader): number => {
  const raw = reader.bytes(8)
  const value = new DataView(raw.buffer, raw.byteOffset, 8).getBigInt64(0, true)
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw malformed(`int64 ${value} is out of range`)
  return Number(value)
}

const readEight = (reader: ByteReader): DataView => {
  const raw = reader.bytes(8)

  return new DataView(raw.buffer, raw.byteOffset, 8)
}

type Decode = (reader: ByteReader, depth: number) => XpcValue

const readArray: Decode = (reader, depth) => {
  const count = readCount(reader)
  const items: XpcValue[] = []
  for (let index = 0; index < count; index++)
    items.push(readObject(reader, depth + 1))
  return items
}

const readDictionary: Decode = (reader, depth) => {
  const count = readCount(reader)
  const entries: [string, XpcValue][] = []
  for (let index = 0; index < count; index++) {
    const key = reader.cstring()
    reader.align(4)
    entries.push([key, readObject(reader, depth + 1)])
  }
  // Own properties even for a key such as `__proto__`.
  return Object.fromEntries(entries)
}

const DECODERS: ReadonlyMap<number, Decode> = new Map<number, Decode>([
  [XpcType.Null, () => null],
  [
    XpcType.Bool,
    (reader) => {
      const value = reader.u8() !== 0
      reader.align(4)
      return value
    }
  ],
  [XpcType.Int64, (reader) => readInt64(reader)],
  [XpcType.Uint64, (reader) => reader.u64le()],
  [XpcType.Double, (reader) => readEight(reader).getFloat64(0, true)],
  [
    XpcType.Date,
    (reader) =>
      new Date(
        Number(readEight(reader).getBigInt64(0, true) / NANOSECONDS_PER_MS)
      )
  ],
  [XpcType.Data, (reader) => readPaddedBytes(reader, reader.u32le())],
  [XpcType.String, (reader) => readString(reader)],
  [XpcType.Uuid, (reader) => new XpcUuid(reader.bytes(XPC_UUID_BYTES))],
  [XpcType.Array, readArray],
  [XpcType.Dictionary, readDictionary]
])

const readObject: Decode = (reader, depth) => {
  if (depth > MAX_DEPTH) throw malformed(`nested deeper than ${MAX_DEPTH}`)
  const at = reader.position
  const type = reader.u32le()
  const decode = DECODERS.get(type)
  if (!decode) throw malformed(`unknown type 0x${type.toString(16)} at ${at}`)
  return decode(reader, depth)
}

/** The object in a message body (after the magic and version). */
export const decodeXpcBody = (body: Uint8Array): XpcValue => {
  try {
    const reader = new ByteReader(body)
    if (reader.u32le() !== XPC_OBJECT_MAGIC) throw malformed('bad object magic')
    reader.u32le() // version: 5 everywhere so far, and nothing depends on it
    return readObject(reader, 0)
  } catch (error) {
    if (error instanceof IPAForgeError && error.code !== ErrorCode.Unexpected)
      throw error
    throw malformed('object runs past its message', error)
  }
}

/** One message: the wrapper (magic, flags, body length, id), then the body if there is one. */
export const encodeXpcMessage = (message: XpcMessage): Uint8Array => {
  const body =
    message.body === undefined ? new Uint8Array() : encodeXpcBody(message.body)

  return new ByteWriter(XPC_WRAPPER_BYTES + body.length)
    .u32le(XPC_WRAPPER_MAGIC)
    .u32le(message.flags)
    .u64le(BigInt(body.length))
    .u64le(message.id)
    .bytes(body)
    .toBytes()
}

/** Splits one stream's DATA bytes into messages, keeping a partial one until the rest arrives. */
export const createXpcMessageReader = (maxMessageBytes: number) => {
  let pending: Uint8Array = new Uint8Array()

  const next = (): XpcMessage | undefined => {
    if (pending.length < XPC_WRAPPER_BYTES) return undefined
    const reader = new ByteReader(pending)
    if (reader.u32le() !== XPC_WRAPPER_MAGIC)
      throw malformed('bad wrapper magic')
    const flags = reader.u32le()
    const length = reader.u64le()
    const id = reader.u64le()
    if (length > BigInt(maxMessageBytes))
      throw malformed(`a ${length}-byte message exceeds the limit`)
    const end = XPC_WRAPPER_BYTES + Number(length)
    if (pending.length < end) return undefined
    const body = pending.subarray(XPC_WRAPPER_BYTES, end)
    pending = pending.slice(end)

    return length === 0n
      ? { flags, id }
      : { flags, id, body: decodeXpcBody(body) }
  }

  /** Every message `chunk` completes, in order. */
  return (chunk: Uint8Array): XpcMessage[] => {
    pending = concatBytes([pending, chunk])
    const messages: XpcMessage[] = []
    for (let message = next(); message; message = next()) messages.push(message)
    return messages
  }
}

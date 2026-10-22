// DNS messages as mDNS uses them (RFC 1035, RFC 6762): building a query and reading the records of an answer,
// name compression included. Records of types the device adverts don't use are skipped.
import {
  CLASS_IN,
  CLASS_MASK,
  MAX_NAME_JUMPS,
  RecordType
} from '@device/infrastructure/mdns/constants.ts'
import type {
  DnsMessage,
  DnsQuestion,
  ResourceRecord
} from '@device/infrastructure/mdns/types.ts'
import {
  ByteReader,
  ByteWriter,
  ErrorCode,
  IPAForgeError,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

const HEADER_BYTES = 12
const RESPONSE_FLAG = 0x80_00
const POINTER = 0xc0

const malformed = (message: string) =>
  new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: `mDNS: ${message}`
  })

const writeName = (writer: ByteWriter, name: string): void => {
  for (const label of name.split('.').filter(Boolean)) {
    const bytes = utf8Encode(label)
    if (bytes.length > 63) throw malformed(`label too long in ${name}`)
    writer.u8(bytes.length).bytes(bytes)
  }
  writer.u8(0)
}

/** A query for `questions`, with `id` (an answer sent back to our own port echoes it). */
export const encodeQuery = (
  questions: readonly DnsQuestion[],
  id: number
): Uint8Array => {
  const writer = new ByteWriter()
  writer.u16be(id).u16be(0).u16be(questions.length).u16be(0).u16be(0).u16be(0)
  for (const question of questions) {
    writeName(writer, question.name)
    writer.u16be(question.type).u16be(CLASS_IN)
  }

  return writer.toBytes()
}

/** Reads the name at `offset`, following compression pointers; returns it and where the name ended. */
const readName = (
  bytes: Uint8Array,
  offset: number
): { readonly name: string; readonly end: number } => {
  const labels: string[] = []
  let position = offset
  let end: number | undefined
  for (let jumps = 0; jumps <= MAX_NAME_JUMPS; ) {
    const length = bytes[position]
    if (length === undefined) throw malformed('name runs past the message')
    if (length === 0)
      return { name: labels.join('.'), end: end ?? position + 1 }
    if ((length & POINTER) === POINTER) {
      const low = bytes[position + 1]
      if (low === undefined) throw malformed('pointer runs past the message')
      end ??= position + 2
      position = ((length & ~POINTER) << 8) | low
      jumps++
      continue
    }
    labels.push(utf8Decode(bytes.subarray(position + 1, position + 1 + length)))
    position += 1 + length
  }
  throw malformed('name compression loops')
}

const ipv4 = (data: Uint8Array): string => [...data].join('.')

const ipv6 = (data: Uint8Array): string => {
  const groups: string[] = []
  for (let index = 0; index < 16; index += 2)
    groups.push(
      (((data[index] ?? 0) << 8) | (data[index + 1] ?? 0)).toString(16)
    )
  return groups.join(':')
}

const txtEntries = (data: Uint8Array): string[] => {
  const entries: string[] = []
  for (let position = 0; position < data.length; ) {
    const length = data[position] ?? 0
    if (length > 0)
      entries.push(
        utf8Decode(data.subarray(position + 1, position + 1 + length))
      )
    position += 1 + length
  }
  return entries
}

const readRecord = (
  bytes: Uint8Array,
  offset: number
): { readonly record: ResourceRecord | undefined; readonly end: number } => {
  const { name, end: nameEnd } = readName(bytes, offset)
  const reader = new ByteReader(bytes, nameEnd)
  if (reader.remaining < 10)
    throw malformed('record header runs past the message')
  const type = reader.u16be()
  const recordClass = reader.u16be() & CLASS_MASK
  const ttl = reader.u32be()
  const length = reader.u16be()
  if (reader.remaining < length)
    throw malformed('record data runs past the message')
  const dataStart = reader.position
  const data = reader.bytes(length)
  const end = dataStart + length
  if (recordClass !== CLASS_IN) return { record: undefined, end }
  const base = { name, ttl }
  if (type === RecordType.PTR)
    return {
      record: { ...base, type, target: readName(bytes, dataStart).name },
      end
    }
  if (type === RecordType.SRV) {
    const port = ((data[4] ?? 0) << 8) | (data[5] ?? 0)

    return {
      record: {
        ...base,
        type,
        port,
        target: readName(bytes, dataStart + 6).name
      },
      end
    }
  }
  if (type === RecordType.TXT)
    return { record: { ...base, type, entries: txtEntries(data) }, end }
  if (type === RecordType.A && length === 4)
    return { record: { ...base, type, address: ipv4(data) }, end }
  if (type === RecordType.AAAA && length === 16)
    return { record: { ...base, type, address: ipv6(data) }, end }
  return { record: undefined, end }
}

/** Every record an mDNS message carries (answers, authority, additional); questions are skipped. */
export const decodeMessage = (bytes: Uint8Array): DnsMessage => {
  if (bytes.length < HEADER_BYTES)
    throw malformed('message shorter than its header')
  const header = new ByteReader(bytes)
  const id = header.u16be()
  const flags = header.u16be()
  const questions = header.u16be()
  const recordCount = header.u16be() + header.u16be() + header.u16be()
  let position = HEADER_BYTES
  for (let index = 0; index < questions; index++)
    position = readName(bytes, position).end + 4
  const records: ResourceRecord[] = []
  for (let index = 0; index < recordCount; index++) {
    const { record, end } = readRecord(bytes, position)
    if (record) records.push(record)
    position = end
  }

  return { id, isResponse: (flags & RESPONSE_FLAG) !== 0, records }
}

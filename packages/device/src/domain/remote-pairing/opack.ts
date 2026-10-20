// OPACK, Apple's compact binary format for the device info dictionaries of pair-setup: the subset these carry
// (booleans, null, integers, strings, data, arrays and dictionaries). Integers and lengths are little-endian.
import type { OpackValue } from '@device/domain/remote-pairing/types.ts'
import {
  ErrorCode,
  IPAForgeError,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

const Tag = {
  true: 0x01,
  false: 0x02,
  null: 0x04,
  smallInt: 0x08,
  int8: 0x30,
  int16: 0x31,
  int32: 0x32,
  int64: 0x33,
  shortString: 0x40,
  string8: 0x61,
  string16: 0x62,
  string32: 0x64,
  shortData: 0x70,
  data8: 0x91,
  data16: 0x92,
  data32: 0x94,
  array: 0xd0,
  endlessArray: 0xdf,
  dict: 0xe0,
  endlessDict: 0xef,
  terminator: 0x03
} as const

/** 0…39 are encoded in the tag itself; up to 32 bytes of string or data too; up to 14 items of a collection. */
const MAX_SMALL_INT = 39
const MAX_SHORT_LENGTH = 32
const MAX_SHORT_COUNT = 14

const littleEndian = (value: number, bytes: number): number[] =>
  Array.from({ length: bytes }, (_, index) =>
    Number((BigInt(value) >> BigInt(index * 8)) & 0xffn)
  )

const lengthPrefixed = (
  bytes: Uint8Array,
  short: number,
  tags: readonly [number, number, number]
): number[] => {
  const length = bytes.byteLength
  if (length <= MAX_SHORT_LENGTH) return [short + length, ...bytes]
  if (length <= 0xff) return [tags[0], length, ...bytes]
  if (length <= 0xff_ff) return [tags[1], ...littleEndian(length, 2), ...bytes]

  return [tags[2], ...littleEndian(length, 4), ...bytes]
}

const encodeInteger = (value: number): number[] => {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new IPAForgeError(ErrorCode.Unexpected, {
      message: `OPACK: unsupported number ${value}`
    })
  if (value <= MAX_SMALL_INT) return [Tag.smallInt + value]
  if (value <= 0xff) return [Tag.int8, value]
  if (value <= 0xff_ff) return [Tag.int16, ...littleEndian(value, 2)]
  if (value <= 0xff_ff_ff_ff) return [Tag.int32, ...littleEndian(value, 4)]

  return [Tag.int64, ...littleEndian(value, 8)]
}

const collection = (
  items: readonly number[][],
  count: number,
  short: number,
  endless: number
): number[] =>
  count <= MAX_SHORT_COUNT
    ? [short + count, ...items.flat()]
    : [endless, ...items.flat(), Tag.terminator]

const encodeValue = (value: OpackValue): number[] => {
  if (value === true) return [Tag.true]
  if (value === false) return [Tag.false]
  if (value === null) return [Tag.null]
  if (typeof value === 'number') return encodeInteger(value)
  if (typeof value === 'string')
    return lengthPrefixed(utf8Encode(value), Tag.shortString, [
      Tag.string8,
      Tag.string16,
      Tag.string32
    ])
  if (value instanceof Uint8Array)
    return lengthPrefixed(value, Tag.shortData, [
      Tag.data8,
      Tag.data16,
      Tag.data32
    ])
  if (Array.isArray(value))
    return collection(
      value.map(encodeValue),
      value.length,
      Tag.array,
      Tag.endlessArray
    )
  const entries = Object.entries(value as Record<string, OpackValue>)

  return collection(
    entries.map(([key, item]) => [...encodeValue(key), ...encodeValue(item)]),
    entries.length,
    Tag.dict,
    Tag.endlessDict
  )
}

export const encodeOpack = (value: OpackValue): Uint8Array =>
  new Uint8Array(encodeValue(value))

const malformed = (message: string) =>
  new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: `OPACK: ${message}`
  })

/** Marks the end of an endless collection while decoding. */
const END = Symbol('end')

type Decoded = readonly [OpackValue | typeof END, number]

const INT_SIZES: Readonly<Record<number, number>> = {
  [Tag.int8]: 1,
  [Tag.int16]: 2,
  [Tag.int32]: 4,
  [Tag.int64]: 8
}

const SCALARS: Readonly<Record<number, OpackValue | typeof END>> = {
  [Tag.true]: true,
  [Tag.false]: false,
  [Tag.null]: null,
  [Tag.terminator]: END
}

/** The length prefixes after the short forms: 1, 2 and 4 bytes. */
const PREFIX_SIZES = [1, 2, 4] as const

const createDecoder = (bytes: Uint8Array) => {
  const readUint = (at: number, size: number): number => {
    if (at + size > bytes.byteLength) throw malformed('truncated')
    let value = 0
    for (let index = size - 1; index >= 0; index--)
      value = value * 256 + (bytes[at + index] as number)
    return value
  }

  const take = (at: number, length: number): Uint8Array => {
    if (at + length > bytes.byteLength) throw malformed('truncated')
    return bytes.slice(at, at + length)
  }

  /** A string's or data's length and where its bytes start, or undefined when `tag` isn't that kind. */
  const sized = (
    tag: number,
    at: number,
    short: number,
    tags: readonly [number, number, number]
  ): readonly [number, number] | undefined => {
    if (tag >= short && tag <= short + MAX_SHORT_LENGTH)
      return [tag - short, at]
    const index = tags.indexOf(tag)
    if (index < 0) return undefined
    const size = PREFIX_SIZES[index] as number

    return [readUint(at, size), at + size]
  }

  const items = (count: number | undefined, at: number) => {
    const found: OpackValue[] = []
    let cursor = at
    while (count === undefined || found.length < count) {
      const [item, after] = decode(cursor)
      cursor = after
      if (item === END) {
        if (count !== undefined) throw malformed('unexpected terminator')
        break
      }
      found.push(item)
    }
    return [found, cursor] as const
  }

  const dictOf = (pairs: readonly OpackValue[]): OpackValue => {
    const dict: Record<string, OpackValue> = {}
    for (let index = 0; index + 1 < pairs.length; index += 2) {
      const key = pairs[index]
      if (typeof key !== 'string')
        throw malformed('dictionary key is not a string')
      dict[key] = pairs[index + 1] as OpackValue
    }
    return dict
  }

  const collectionAt = (tag: number, at: number): Decoded => {
    const isArray = tag >= Tag.array && tag <= Tag.endlessArray
    if (!(isArray || (tag >= Tag.dict && tag <= Tag.endlessDict)))
      throw malformed(`unsupported tag 0x${tag.toString(16)}`)
    const base = isArray ? Tag.array : Tag.dict
    const endless = isArray ? Tag.endlessArray : Tag.endlessDict
    const perItem = isArray ? 1 : 2
    const count = tag === endless ? undefined : (tag - base) * perItem
    const [found, cursor] = items(count, at)

    return [isArray ? found : dictOf(found), cursor]
  }

  const decode = (offset: number): Decoded => {
    const tag = bytes[offset]
    if (tag === undefined) throw malformed('truncated')
    const next = offset + 1
    if (tag in SCALARS) return [SCALARS[tag] as OpackValue | typeof END, next]
    if (tag >= Tag.smallInt && tag <= Tag.smallInt + MAX_SMALL_INT)
      return [tag - Tag.smallInt, next]
    const intSize = INT_SIZES[tag]
    if (intSize !== undefined) return [readUint(next, intSize), next + intSize]
    const string = sized(tag, next, Tag.shortString, [
      Tag.string8,
      Tag.string16,
      Tag.string32
    ])
    if (string)
      return [utf8Decode(take(string[1], string[0])), string[1] + string[0]]
    const data = sized(tag, next, Tag.shortData, [
      Tag.data8,
      Tag.data16,
      Tag.data32
    ])
    if (data) return [take(data[1], data[0]), data[1] + data[0]]

    return collectionAt(tag, next)
  }

  return decode
}

export const decodeOpack = (bytes: Uint8Array): OpackValue => {
  const [value, after] = createDecoder(bytes)(0)
  if (value === END || after !== bytes.byteLength)
    throw malformed('trailing bytes')
  return value
}

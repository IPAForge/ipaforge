import { failBinaryPlist as fail } from '@kernel/plist/binary-error.ts'
import {
  BPLIST_HEADER_SIZE,
  BPLIST_TRAILER_SIZE,
  EXTENDED_LENGTH_NIBBLE,
  isBinaryPlist,
  markerNibble,
  markerType,
  ObjectType,
  TrailerField,
  VALID_INT_SIZES
} from '@kernel/plist/binary-format.ts'

type Trailer = {
  readonly offsetIntSize: number
  readonly objectRefSize: number
  readonly numObjects: number
  readonly topObject: number
  readonly offsetTableOffset: number
}

/** Bounds-checked access to the objects of a `bplist00` file. */
export type BinaryPlistReader = {
  readonly bytes: Uint8Array
  readonly view: DataView
  readonly topObject: number
  /** File offset of object `ref`, via the offset table. */
  readonly objectOffset: (ref: number) => number
  /** Length of an object: low nibble, or a following int object when the nibble is 0xF. */
  readonly readLength: (
    offset: number,
    nibble: number
  ) => { length: number; dataStart: number }
  /** Reference number `index` of a container whose references start at `dataStart`. */
  readonly readRef: (dataStart: number, index: number) => number
  /** A container's references must lie inside the object area, which also bounds `length`. */
  readonly assertRefsInBounds: (
    dataStart: number,
    count: number,
    offset: number
  ) => void
}

const readTrailer = (bytes: Uint8Array, view: DataView): Trailer => {
  const start = bytes.byteLength - BPLIST_TRAILER_SIZE
  const trailer: Trailer = {
    offsetIntSize: view.getUint8(start + TrailerField.OffsetIntSize),
    objectRefSize: view.getUint8(start + TrailerField.ObjectRefSize),
    numObjects: Number(
      view.getBigUint64(start + TrailerField.NumObjects, false)
    ),
    topObject: Number(view.getBigUint64(start + TrailerField.TopObject, false)),
    offsetTableOffset: Number(
      view.getBigUint64(start + TrailerField.OffsetTableOffset, false)
    )
  }
  if (
    !VALID_INT_SIZES.includes(trailer.offsetIntSize) ||
    !VALID_INT_SIZES.includes(trailer.objectRefSize)
  )
    fail('bad trailer sizes')
  const offsetTableEnd =
    trailer.offsetTableOffset + trailer.numObjects * trailer.offsetIntSize
  if (offsetTableEnd > start || trailer.topObject >= trailer.numObjects)
    fail('bad offset table')
  return trailer
}

export const createBinaryPlistReader = (
  bytes: Uint8Array
): BinaryPlistReader => {
  if (
    !isBinaryPlist(bytes) ||
    bytes.byteLength < BPLIST_HEADER_SIZE + BPLIST_TRAILER_SIZE
  )
    fail('not a bplist00 file')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const {
    offsetIntSize,
    objectRefSize,
    numObjects,
    topObject,
    offsetTableOffset
  } = readTrailer(bytes, view)

  /** Big-endian unsigned integer of `size` bytes; must stay a safe integer. */
  const readUInt = (offset: number, size: number): number => {
    if (offset + size > bytes.byteLength)
      fail('read past end', { offset, size })
    let value = 0
    for (let i = 0; i < size; i++)
      value = value * 256 + (bytes[offset + i] as number)
    if (!Number.isSafeInteger(value)) fail('integer too large', { offset })
    return value
  }

  const objectOffset = (ref: number): number => {
    if (ref >= numObjects) fail('object reference out of range', { ref })
    const offset = readUInt(
      offsetTableOffset + ref * offsetIntSize,
      offsetIntSize
    )
    if (offset < BPLIST_HEADER_SIZE || offset >= offsetTableOffset)
      fail('object offset out of range', { ref, offset })
    return offset
  }

  const readLength = (
    offset: number,
    nibble: number
  ): { length: number; dataStart: number } => {
    if (nibble !== EXTENDED_LENGTH_NIBBLE)
      return { length: nibble, dataStart: offset + 1 }
    const marker = bytes[offset + 1] as number
    if (markerType(marker) !== ObjectType.Integer)
      fail('bad extended length', { offset })
    const size = 1 << markerNibble(marker)

    return { length: readUInt(offset + 2, size), dataStart: offset + 2 + size }
  }

  const readRef = (dataStart: number, index: number): number =>
    readUInt(dataStart + index * objectRefSize, objectRefSize)

  const assertRefsInBounds = (
    dataStart: number,
    count: number,
    offset: number
  ): void => {
    if (dataStart + count * objectRefSize > offsetTableOffset)
      fail('container exceeds the object area', { offset, count })
  }

  return {
    bytes,
    view,
    topObject,
    objectOffset,
    readLength,
    readRef,
    assertRefsInBounds
  }
}

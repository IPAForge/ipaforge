// Layout of a `bplist00` file: header, objects, offset table, then a fixed-size trailer.

export const BPLIST_HEADER = 'bplist00'
export const BPLIST_HEADER_SIZE = BPLIST_HEADER.length
export const BPLIST_TRAILER_SIZE = 32

/** Byte offsets of the trailer fields, relative to the start of the trailer. */
export const TrailerField = {
  OffsetIntSize: 6,
  ObjectRefSize: 7,
  NumObjects: 8,
  TopObject: 16,
  OffsetTableOffset: 24
} as const

/** Widths allowed for offset-table entries and object references. */
export const VALID_INT_SIZES: readonly number[] = [1, 2, 4, 8]

/** High nibble of an object marker. */
export const ObjectType = {
  Simple: 0x0,
  Integer: 0x1,
  Real: 0x2,
  Date: 0x3,
  Data: 0x4,
  AsciiString: 0x5,
  Utf16String: 0x6,
  Array: 0xa,
  Set: 0xc,
  Dict: 0xd
} as const

/** Full marker bytes with a fixed meaning. */
export const Marker = {
  False: 0x08,
  True: 0x09,
  Date: 0x33
} as const

/** A low nibble of 0xF means the length follows as an integer object. */
export const EXTENDED_LENGTH_NIBBLE = 0xf

/** Integers wider than this are not valid. */
export const MAX_INTEGER_SIZE = 16
/** 1, 2 and 4-byte integers are unsigned; 8- and 16-byte integers are signed two's complement. */
export const MIN_SIGNED_INTEGER_SIZE = 8

/** Size accounted for scalars that carry no string/data payload. */
export const SCALAR_SIZE = 8

/** Seconds between the Unix epoch and the Core Foundation epoch (2001-01-01T00:00:00Z). */
export const CF_EPOCH_OFFSET = 978307200

export const markerType = (marker: number): number => marker >> 4
export const markerNibble = (marker: number): number => marker & 0xf

export const isBinaryPlist = (bytes: Uint8Array): boolean =>
  bytes.byteLength >= BPLIST_HEADER_SIZE &&
  String.fromCharCode(...bytes.subarray(0, BPLIST_HEADER_SIZE)) ===
    BPLIST_HEADER

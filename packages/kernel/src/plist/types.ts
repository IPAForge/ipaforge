import type { ObjectType } from '@kernel/plist/binary-format.ts'
import type { PlistReal } from '@kernel/plist/model.ts'
import type { createXmlReader } from '@kernel/plist/xml-reader.ts'

export type Parsed = {
  readonly value: PlistValue
  /** Nodes in the fully expanded subtree. */
  readonly nodes: number
  /** String/data bytes in the fully expanded subtree. */
  readonly bytes: number
  /** Height of the subtree (1 for scalars). Checked on every reuse, so cached subtrees can't deepen the tree. */
  readonly height: number
}

/** Running totals of a container while its children are parsed. */
export type Totals = {
  nodes: number
  bytes: number
  height: number
}

export type Trailer = {
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

/**
 * Property-list values with full type fidelity.
 *
 *  - `number`  → `<integer>` (safe integers)      - `bigint`   → `<integer>` beyond 2^53
 *  - `PlistReal` → `<real>` (kept distinct so `1.0` never silently becomes an integer)
 *  - `Uint8Array` → `<data>`, `Date` → `<date>`, arrays and dicts as usual.
 */
export type PlistValue =
  | string
  | boolean
  | number
  | bigint
  | PlistReal
  | Uint8Array
  | Date
  | readonly PlistValue[]
  | PlistDict

export type PlistDict = {
  readonly [key: string]: PlistValue
}

export type Tag = {
  readonly name: string
  readonly closing: boolean
  readonly selfClosing: boolean
  readonly start: number
  readonly end: number
}

export type XmlReader = ReturnType<typeof createXmlReader>

/** A binary plist object type: the high nibble of its marker byte. */
export type ObjectTypeCode = (typeof ObjectType)[keyof typeof ObjectType]

/** One binary plist object to decode, located by its marker byte. */
export type EncodedObject = {
  readonly ref: number
  readonly offset: number
  readonly marker: number
  /** The marker's low nibble (a length or size, depending on the type). */
  readonly nibble: number
  readonly depth: number
  readonly stack: Set<number>
}

/** Decodes the objects of one type. */
export type ObjectDecoder = (object: EncodedObject) => Parsed

/** The XML plist elements a value can be. */
export type PlistElement =
  | 'dict'
  | 'array'
  | 'string'
  | 'integer'
  | 'real'
  | 'true'
  | 'false'
  | 'data'
  | 'date'

/** Parses the value an opening tag starts. */
export type ElementParser = (
  reader: XmlReader,
  tag: Tag,
  depth: number,
  maxDepth: number
) => PlistValue

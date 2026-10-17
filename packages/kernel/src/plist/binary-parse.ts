import { failBinaryPlist as fail } from '@kernel/plist/binary-error.ts'
import {
  addChild,
  emptyContainerTotals,
  exceedsLimits
} from '@kernel/plist/binary-expansion.ts'
import {
  markerNibble,
  markerType,
  ObjectType
} from '@kernel/plist/binary-format.ts'
import { createBinaryPlistReader } from '@kernel/plist/binary-reader.ts'
import {
  decodeAsciiString,
  decodeData,
  decodeDate,
  decodeInteger,
  decodeReal,
  decodeSimple,
  decodeUtf16String
} from '@kernel/plist/binary-scalars.ts'
import { DEFAULT_PLIST_LIMITS, type PlistLimits } from '@kernel/plist/limits.ts'
import { createDict } from '@kernel/plist/model.ts'
import type {
  BinaryPlistReader,
  ObjectDecoder,
  ObjectTypeCode,
  Parsed,
  PlistValue
} from '@kernel/plist/types.ts'

/** Parses objects by reference, memoising each one with the totals of its expansion. */
const createObjectParser = (reader: BinaryPlistReader, limits: PlistLimits) => {
  const memo = new Map<number, Parsed>()

  const checkBudget = (parsed: Parsed, offset: number): Parsed => {
    if (exceedsLimits(parsed, limits)) {
      fail('expands beyond the size limits (shared-reference expansion)', {
        offset,
        nodes: parsed.nodes,
        bytes: parsed.bytes
      })
    }
    return parsed
  }

  const parseObject = (
    ref: number,
    depth: number,
    stack: Set<number>
  ): Parsed => {
    const cached = memo.get(ref)
    if (cached) {
      // a subtree first parsed near the root must not be re-attached deeper than the limit allows
      if (depth + cached.height - 1 > limits.maxDepth)
        fail('nesting too deep', { ref })
      return cached
    }
    if (depth > limits.maxDepth) fail('nesting too deep')
    if (stack.has(ref)) fail('reference cycle', { ref })
    const offset = reader.objectOffset(ref)
    const parsed = checkBudget(decode(ref, offset, depth, stack), offset)
    memo.set(ref, parsed)
    return parsed
  }

  /** Arrays and sets: `length` object references. Both decode to an array. */
  const decodeArray = (
    ref: number,
    offset: number,
    nibble: number,
    depth: number,
    stack: Set<number>
  ): Parsed => {
    const { length, dataStart } = reader.readLength(offset, nibble)
    reader.assertRefsInBounds(dataStart, length, offset)
    const nextStack = new Set(stack).add(ref)
    const items: PlistValue[] = []
    const totals = emptyContainerTotals()
    for (let i = 0; i < length; i++) {
      const child = parseObject(
        reader.readRef(dataStart, i),
        depth + 1,
        nextStack
      )
      items.push(child.value)
      addChild(totals, child)
      if (exceedsLimits(totals, limits)) break // checkBudget reports it
    }
    return { value: items, ...totals }
  }

  /** Dicts: `length` key references, then `length` value references in the same order. */
  const decodeDict = (
    ref: number,
    offset: number,
    nibble: number,
    depth: number,
    stack: Set<number>
  ): Parsed => {
    const { length, dataStart } = reader.readLength(offset, nibble)
    reader.assertRefsInBounds(dataStart, length * 2, offset)
    const nextStack = new Set(stack).add(ref)
    const entries: [string, PlistValue][] = []
    const totals = emptyContainerTotals()
    for (let i = 0; i < length; i++) {
      const key = parseObject(
        reader.readRef(dataStart, i),
        depth + 1,
        nextStack
      )
      if (typeof key.value !== 'string')
        fail('dictionary key is not a string', { offset })
      const value = parseObject(
        reader.readRef(dataStart, length + i),
        depth + 1,
        nextStack
      )
      entries.push([key.value as string, value.value])
      addChild(totals, key)
      addChild(totals, value)
      if (exceedsLimits(totals, limits)) break // checkBudget reports it
    }
    return { value: createDict(entries), ...totals }
  }

  const decoders = {
    [ObjectType.Simple]: ({ marker, offset }) => decodeSimple(marker, offset),
    [ObjectType.Integer]: ({ offset, nibble }) =>
      decodeInteger(reader, offset, nibble),
    [ObjectType.Real]: ({ offset, nibble }) =>
      decodeReal(reader, offset, nibble),
    [ObjectType.Date]: ({ offset, marker }) =>
      decodeDate(reader, offset, marker),
    [ObjectType.Data]: ({ offset, nibble }) =>
      decodeData(reader, offset, nibble),
    [ObjectType.AsciiString]: ({ offset, nibble }) =>
      decodeAsciiString(reader, offset, nibble),
    [ObjectType.Utf16String]: ({ offset, nibble }) =>
      decodeUtf16String(reader, offset, nibble),
    [ObjectType.Array]: ({ ref, offset, nibble, depth, stack }) =>
      decodeArray(ref, offset, nibble, depth, stack),
    [ObjectType.Set]: ({ ref, offset, nibble, depth, stack }) =>
      decodeArray(ref, offset, nibble, depth, stack),
    [ObjectType.Dict]: ({ ref, offset, nibble, depth, stack }) =>
      decodeDict(ref, offset, nibble, depth, stack)
  } satisfies Record<ObjectTypeCode, ObjectDecoder>

  const decode = (
    ref: number,
    offset: number,
    depth: number,
    stack: Set<number>
  ): Parsed => {
    const marker = reader.bytes[offset] as number
    const decoder: ObjectDecoder | undefined = (
      decoders as Partial<Record<number, ObjectDecoder>>
    )[markerType(marker)]
    if (!decoder) return fail('unsupported object type', { offset, marker })
    return decoder({
      ref,
      offset,
      marker,
      nibble: markerNibble(marker),
      depth,
      stack
    })
  }

  return parseObject
}

/**
 * Parses a `bplist00` property list. Objects may be shared (a DAG), so a tiny file can describe an
 * exponentially large tree; each object is parsed once and carries the node/byte totals and height of its
 * expansion, which `limits` caps (anything that later walks the result is bounded by the same totals).
 */
export const parseBinaryPlist = (
  bytes: Uint8Array,
  limits: PlistLimits = DEFAULT_PLIST_LIMITS
): PlistValue => {
  const reader = createBinaryPlistReader(bytes)
  const parseObject = createObjectParser(reader, limits)

  return parseObject(reader.topObject, 0, new Set()).value
}

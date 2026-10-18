// Regression tests for hostile inputs (security review 2026-10-13): every case must fail fast with a
// IPAForgeError instead of exhausting memory or CPU.

import { describe, expect, it } from 'vitest'

import { ErrorCode, parseBinaryPlist, utf8Encode } from '@ipaforge/kernel'
import { thrownCode } from '@signer/__tests__/errors.ts'
import { readFixture } from '@signer/__tests__/fixtures.ts'
import { DEFAULT_SIGNER_LIMITS } from '@signer/domain/config.ts'
import { findSegment, parseMachO } from '@signer/domain/macho/parse.ts'

const MAX_FAT_ARCHES = DEFAULT_SIGNER_LIMITS.machO.maxFatArches

/** Hostile input must be rejected within this budget, not exhaust CPU. */
const FAST_MS = 1000

/** How `run` failed (its error code) and whether it failed fast. */
const hostile = (
  run: () => unknown
): { readonly code: string | undefined; readonly fast: boolean } => {
  const started = performance.now()
  const code = thrownCode(run)

  return { code, fast: performance.now() - started < FAST_MS }
}

/** Builds a bplist00 from raw object encodings (refs are 1 byte, offsets 4 bytes). */
const bplist = (objects: readonly Uint8Array[], top = 0): Uint8Array => {
  const header = utf8Encode('bplist00')
  const offsets: number[] = []
  let position = header.length
  for (const object of objects) {
    offsets.push(position)
    position += object.length
  }
  const offsetTable = new Uint8Array(objects.length * 4)
  const view = new DataView(offsetTable.buffer)
  for (const [i, offset] of offsets.entries())
    view.setUint32(i * 4, offset, false)
  const trailer = new Uint8Array(32)
  const tv = new DataView(trailer.buffer)
  tv.setUint8(6, 4) // offset int size
  tv.setUint8(7, 1) // object ref size
  tv.setBigUint64(8, BigInt(objects.length), false)
  tv.setBigUint64(16, BigInt(top), false)
  tv.setBigUint64(24, BigInt(position), false)
  const out = new Uint8Array(position + offsetTable.length + 32)
  out.set(header, 0)
  let at = header.length
  for (const object of objects) {
    out.set(object, at)
    at += object.length
  }
  out.set(offsetTable, position)
  out.set(trailer, position + offsetTable.length)
  return out
}

describe('binary plist hardening', () => {
  it('rejects a container whose declared length exceeds the file (no huge allocation)', () => {
    // array with an extended length of 2^40 elements: 0xAF, then int marker 0x13 (8 bytes)
    const hugeArray = new Uint8Array([0xaf, 0x13, 0, 0, 0x01, 0, 0, 0, 0, 0])
    expect(hostile(() => parseBinaryPlist(bplist([hugeArray])))).toEqual({
      code: ErrorCode.InvalidPlist,
      fast: true
    })
  })

  it('rejects shared-reference expansion (a few hundred bytes describing 2^40 nodes)', () => {
    // object i = [i+1, i+1] for 40 levels, last object = "x"
    const levels = 40
    const objects = Array.from(
      { length: levels },
      (_, i) => new Uint8Array([0xa2, i + 1, i + 1])
    )
    objects.push(new Uint8Array([0x51, 0x78]))
    expect(hostile(() => parseBinaryPlist(bplist(objects)))).toEqual({
      code: ErrorCode.InvalidPlist,
      fast: true
    })
  })

  it('caps expanded BYTES, not just object visits (one big string shared 62,500 times)', () => {
    // [0] = 250 × ref 1; [1] = 250 × ref 2; [2] = a 4 KiB ASCII string → 250·250·4096 B ≈ 256 MiB expanded,
    // while only 62,503 nodes — a node-count cap alone would let this through.
    const level = (next: number) =>
      new Uint8Array([0xaf, 0x10, 250, ...new Array(250).fill(next)])
    const longString = new Uint8Array([
      0x5f,
      0x11,
      0x10,
      0x00,
      ...new Array(4096).fill(0x61)
    ])
    expect(
      hostile(() => parseBinaryPlist(bplist([level(1), level(2), longString])))
    ).toEqual({ code: ErrorCode.InvalidPlist, fast: true })
  })

  it('parses each shared object once (linear time on large but legal DAGs)', () => {
    // 200 levels deep is over the default maxDepth; use 60 levels of [next, next]: 2^60 expanded nodes → rejected fast
    const objects = Array.from(
      { length: 60 },
      (_, i) => new Uint8Array([0xa2, i + 1, i + 1])
    )
    objects.push(new Uint8Array([0x51, 0x78]))
    expect(hostile(() => parseBinaryPlist(bplist(objects)))).toEqual({
      code: ErrorCode.InvalidPlist,
      fast: true
    })
  })

  it('keeps the depth limit when a cached subtree is reused deeper in the tree', () => {
    // root = [chainA, chainB]; chainA = 40 nested arrays ending in "x"; chainB = 40 nested arrays ending in a
    // reference to chainA's head (already parsed and cached) → height ≈ 81 > default maxDepth (64)
    const chain = (first: number, length: number, last: number) =>
      Array.from(
        { length },
        (_, i) =>
          new Uint8Array([0xa1, i === length - 1 ? last : first + i + 1])
      )
    const objects: Uint8Array[] = [new Uint8Array([0xa2, 1, 42])]
    objects.push(...chain(1, 40, 41)) // objects 1..40, last → 41
    objects.push(new Uint8Array([0x51, 0x78])) // 41: "x"
    objects.push(...chain(42, 40, 1)) // objects 42..81, last → chainA head (1)
    expect(hostile(() => parseBinaryPlist(bplist(objects)))).toEqual({
      code: ErrorCode.InvalidPlist,
      fast: true
    })
  })

  it('still parses legitimately shared values', () => {
    const shared = bplist([
      new Uint8Array([0xa3, 1, 1, 1]),
      new Uint8Array([0x51, 0x78])
    ])
    expect(parseBinaryPlist(shared)).toEqual(['x', 'x', 'x'])
  })
})

describe('Mach-O hardening', () => {
  const fat = readFixture('inputs', 'fat')

  it(`rejects fat headers with more than ${MAX_FAT_ARCHES} slices`, () => {
    const bytes = fat.slice()
    new DataView(bytes.buffer).setUint32(4, MAX_FAT_ARCHES + 1, false)
    expect(hostile(() => parseMachO(bytes))).toEqual({
      code: ErrorCode.InvalidMachO,
      fast: true
    })
  })

  it('rejects overlapping fat slices (signing amplification)', () => {
    const bytes = fat.slice()
    const view = new DataView(bytes.buffer)
    // point the second arch at the first arch's slice
    view.setUint32(8 + 20 + 8, view.getUint32(8 + 8, false), false)
    view.setUint32(8 + 20 + 12, view.getUint32(8 + 12, false), false)
    expect(hostile(() => parseMachO(bytes))).toEqual({
      code: ErrorCode.InvalidMachO,
      fast: true
    })
  })

  it('rejects a __LINKEDIT that claims to extend far past the file', () => {
    const bytes = readFixture('inputs', 'thin-min14').slice()
    const linkedit = findSegment(
      parseMachO(bytes).slices[0] ?? (undefined as never),
      '__LINKEDIT'
    )
    if (!linkedit) throw new Error('fixture')
    new DataView(bytes.buffer).setBigUint64(
      linkedit.commandOffset + 48,
      1n << 60n,
      true
    ) // filesize
    expect(hostile(() => parseMachO(bytes))).toEqual({
      code: ErrorCode.InvalidMachO,
      fast: true
    })
  })

  it('rejects a zero-size segment placed far outside the file', () => {
    const bytes = readFixture('inputs', 'thin-min14').slice()
    const linkedit = findSegment(
      parseMachO(bytes).slices[0] ?? (undefined as never),
      '__LINKEDIT'
    )
    if (!linkedit) throw new Error('fixture')
    const view = new DataView(bytes.buffer)
    view.setBigUint64(linkedit.commandOffset + 40, 1n << 60n, true) // fileoff
    view.setBigUint64(linkedit.commandOffset + 48, 0n, true) // filesize
    expect(hostile(() => parseMachO(bytes))).toEqual({
      code: ErrorCode.InvalidMachO,
      fast: true
    })
  })

  it('rejects a segment declaring more sections than its command holds', () => {
    const bytes = readFixture('inputs', 'thin-min14').slice()
    const text = findSegment(
      parseMachO(bytes).slices[0] ?? (undefined as never),
      '__TEXT'
    )
    if (!text) throw new Error('fixture')
    new DataView(bytes.buffer).setUint32(
      text.commandOffset + 64,
      0xffffffff,
      true
    ) // nsects
    expect(hostile(() => parseMachO(bytes))).toEqual({
      code: ErrorCode.InvalidMachO,
      fast: true
    })
  })

  it('rejects ncmds that cannot fit in sizeofcmds', () => {
    const bytes = readFixture('inputs', 'thin-min14').slice()
    new DataView(bytes.buffer).setUint32(16, 0xffffffff, true)
    expect(hostile(() => parseMachO(bytes))).toEqual({
      code: ErrorCode.InvalidMachO,
      fast: true
    })
  })

  it('rejects a code signature pointing outside the file', () => {
    const bytes = readFixture('expected', 'thin-min14').slice()
    const sig = parseMachO(bytes).slices[0]?.codeSignature
    if (!sig) throw new Error('fixture')
    new DataView(bytes.buffer).setUint32(
      sig.commandOffset + 12,
      0x7fffffff,
      true
    ) // datasize
    expect(hostile(() => parseMachO(bytes))).toEqual({
      code: ErrorCode.InvalidMachO,
      fast: true
    })
  })
})

describe('limits are configurable', () => {
  it('applies caller overrides for Mach-O and plists', () => {
    const fat = readFixture('inputs', 'fat')
    expect(parseMachO(fat).slices).toHaveLength(2) // default allows it
    expect(hostile(() => parseMachO(fat, { maxFatArches: 1 }))).toEqual({
      code: ErrorCode.InvalidMachO,
      fast: true
    })

    const nested = bplist([
      new Uint8Array([0xa1, 1]),
      new Uint8Array([0xa1, 2]),
      new Uint8Array([0x51, 0x78])
    ])
    expect(parseBinaryPlist(nested)).toEqual([['x']])
    const strict = { ...DEFAULT_SIGNER_LIMITS.plist, maxDepth: 1 }
    expect(hostile(() => parseBinaryPlist(nested, strict))).toEqual({
      code: ErrorCode.InvalidPlist,
      fast: true
    })
    expect(
      hostile(() =>
        parseBinaryPlist(nested, {
          ...DEFAULT_SIGNER_LIMITS.plist,
          maxExpandedNodes: 2
        })
      )
    ).toEqual({ code: ErrorCode.InvalidPlist, fast: true })
  })
})

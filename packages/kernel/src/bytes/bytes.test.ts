import { describe, expect, it } from 'vitest'

import { fromBase64, toBase64 } from '@kernel/bytes/base64.ts'
import {
  compareBytes,
  concatBytes,
  equalBytes,
  utf8Decode,
  utf8Encode
} from '@kernel/bytes/bytes.ts'
import { fromHex, toHex } from '@kernel/bytes/hex.ts'
import { ByteReader } from '@kernel/bytes/reader.ts'
import { ByteWriter } from '@kernel/bytes/writer.ts'
import { ErrorCode, IPAForgeError } from '@kernel/errors/index.ts'

const bytes = (...values: number[]) => new Uint8Array(values)

describe('bytes helpers', () => {
  it('concatenates and compares', () => {
    expect(concatBytes([bytes(1, 2), bytes(), bytes(3)])).toEqual(
      bytes(1, 2, 3)
    )
    expect(equalBytes(bytes(1, 2), bytes(1, 2))).toBe(true)
    expect(equalBytes(bytes(1, 2), bytes(1, 3))).toBe(false)
    expect(compareBytes(bytes(1, 2), bytes(1, 3))).toBeLessThan(0)
    expect(compareBytes(bytes(1), bytes(1, 0))).toBeLessThan(0)
    expect(compareBytes(bytes(2), bytes(1, 9))).toBeGreaterThan(0)
  })

  it('round-trips UTF-8 and rejects invalid sequences', () => {
    expect(utf8Decode(utf8Encode('é unicode ✓'))).toBe('é unicode ✓')
    expect(() => utf8Decode(bytes(0xff, 0xfe))).toThrow()
  })
})

describe('hex', () => {
  it('round-trips', () => {
    expect(toHex(bytes(0, 15, 255))).toBe('000fff')
    expect(fromHex('00 0F ff')).toEqual(bytes(0, 15, 255))
  })

  it('rejects malformed input', () => {
    expect(() => fromHex('abc')).toThrow(SyntaxError)
    expect(() => fromHex('zz')).toThrow(SyntaxError)
  })
})

describe('base64', () => {
  it('matches known vectors and accepts wrapped input', () => {
    expect(toBase64(utf8Encode('IPAForge'))).toBe('SVBBRm9yZ2U=')
    expect(fromBase64('SVBB\n\tRm9yZ2U=')).toEqual(utf8Encode('IPAForge'))
  })

  it('handles 64 MiB without exhausting the stack', () => {
    const big = new Uint8Array(64 * 1024 * 1024)
    for (let i = 0; i < big.length; i += 4093) big[i] = i & 0xff
    const decoded = fromBase64(toBase64(big))
    expect(decoded.byteLength).toBe(big.byteLength)
    expect(equalBytes(decoded, big)).toBe(true)
  })
})

describe('ByteReader / ByteWriter', () => {
  it('round-trips every width in both endiannesses', () => {
    const written = new ByteWriter(4)
      .u8(0xab)
      .u16le(0x1234)
      .u16be(0x1234)
      .u32le(0xdeadbeef)
      .u32be(0xfade0c02)
      .u64le(0x0102030405060708n)
      .u64be(0x0102030405060708n)
      .cstring('__TEXT')
      .toBytes()

    const reader = new ByteReader(written)
    expect(reader.u8()).toBe(0xab)
    expect(reader.u16le()).toBe(0x1234)
    expect(reader.u16be()).toBe(0x1234)
    expect(reader.u32le()).toBe(0xdeadbeef)
    expect(reader.u32be()).toBe(0xfade0c02)
    expect(reader.u64le()).toBe(0x0102030405060708n)
    expect(reader.u64be()).toBe(0x0102030405060708n)
    expect(reader.cstring()).toBe('__TEXT')
    expect(reader.remaining).toBe(0)
  })

  it('lays out bytes with the requested endianness', () => {
    expect(new ByteWriter().u32le(1).toBytes()).toEqual(bytes(1, 0, 0, 0))
    expect(new ByteWriter().u32be(1).toBytes()).toEqual(bytes(0, 0, 0, 1))
  })

  it('reads fixed-width names like Mach-O segnames', () => {
    const field = new Uint8Array(16)
    field.set(utf8Encode('__LINKEDIT'))
    const reader = new ByteReader(concatBytes([field, bytes(7)]))
    expect(reader.cstring(16)).toBe('__LINKEDIT')
    reader.seek(16)
    expect(reader.u8()).toBe(7)
  })

  it('aligns, skips and patches', () => {
    const writer = new ByteWriter().u8(1).align(4).u32be(0)
    writer.patchU32be(4, 99)
    expect(writer.toBytes()).toEqual(bytes(1, 0, 0, 0, 0, 0, 0, 99))
    const reader = new ByteReader(writer.toBytes()).skip(1).align(4)
    expect(reader.position).toBe(4)
    expect(reader.u32be()).toBe(99)
  })

  it('throws an IPAForgeError on out-of-range reads', () => {
    const reader = new ByteReader(bytes(1, 2, 3))
    expect(() => reader.u32le()).toThrow(IPAForgeError)
    try {
      reader.u32le()
    } catch (error) {
      expect((error as IPAForgeError).code).toBe(ErrorCode.Unexpected)
      expect((error as IPAForgeError).data).toEqual({
        offset: 0,
        length: 4,
        size: 3
      })
    }
    expect(() => reader.seek(4)).toThrow(IPAForgeError)
  })

  it('returns views from bytes() without copying', () => {
    const source = bytes(1, 2, 3, 4)
    const view = new ByteReader(source).skip(1).bytes(2)
    expect(view).toEqual(bytes(2, 3))
    expect(view.buffer).toBe(source.buffer)
  })
})

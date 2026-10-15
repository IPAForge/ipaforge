import { describe, expect, it } from 'vitest'

import { ErrorCode, LoadstarError } from '@loadstar/kernel'
import { binaryCases, readFixture } from '@signer/__tests__/fixtures.ts'
import {
  CPU_TYPE_ARM64,
  MH_DYLIB,
  MH_EXECUTE,
  MH_MAGIC_64,
  Platform
} from '@signer/domain/macho/constants.ts'
import { findSegment, isMachO, parseMachO } from '@signer/domain/macho/parse.ts'
import {
  formatVersion,
  packVersion,
  parseVersion
} from '@signer/domain/macho/version.ts'

const expectCode = (fn: () => unknown, code: string): void => {
  try {
    fn()
    expect.unreachable('expected a LoadstarError')
  } catch (error) {
    expect(error).toBeInstanceOf(LoadstarError)
    expect((error as LoadstarError).code).toBe(code)
  }
}

describe('parseMachO on golden fixtures', () => {
  it.each(binaryCases().map((c) => [c.name, c] as const))(
    '%s parses consistently with the manifest',
    (_name, c) => {
      const input = parseMachO(readFixture('inputs', c.name))
      const signed = parseMachO(readFixture('expected', c.name))

      for (const [index, slice] of input.slices.entries()) {
        expect(slice.is64).toBe(true)
        expect(slice.buildVersion?.platform).toBe(Platform.IOS)
        expect(formatVersion(slice.buildVersion?.minOS ?? 0)).toBe(c.minOS)
        expect(slice.filetype).toBe(c.role === 'dylib' ? MH_DYLIB : MH_EXECUTE)
        expect(slice.uuid).toHaveLength(16)
        expect(slice.cryptid).toBe(0)
        expect(findSegment(slice, '__TEXT')?.fileoff).toBe(0n)
        expect(slice.segments.at(-1)?.name).toBe('__LINKEDIT')
        expect(slice.firstSectionOffset).toBeGreaterThan(
          slice.headerSize + slice.sizeofcmds
        )

        // freshly linked iOS binaries are unsigned (except the re-sign case); codesign adds the command
        expect(slice.codeSignature === undefined).toBe(c.name !== 'resign')
        const signedSlice = signed.slices[index]
        expect(signedSlice?.codeSignature).toBeDefined()
        expect(signedSlice?.ncmds).toBe(
          slice.ncmds + (slice.codeSignature ? 0 : 1)
        )
      }
    }
  )

  it("parses the universal binary's fat header", () => {
    const fat = parseMachO(readFixture('inputs', 'fat'))
    expect(fat.fat).toHaveLength(2)
    expect(fat.slices).toHaveLength(2)
    expect(
      fat.fat?.every(
        (arch) => arch.cputype === CPU_TYPE_ARM64 && arch.align === 14
      )
    ).toBe(true)
    expect(fat.slices.map((s) => s.fileOffset)).toEqual(
      fat.fat?.map((a) => a.offset)
    )
    expect(fat.slices[0]?.fileOffset).toBe(0x4000)
  })

  it('reads 32-bit slices', () => {
    const bytes = readFixture('inputs', 'thin-min14').slice()
    // Patch a 64-bit header into a minimal 32-bit one: no load commands.
    const view = new DataView(bytes.buffer)
    view.setUint32(0, 0xfeedface, true)
    view.setUint32(16, 0, true) // ncmds
    view.setUint32(20, 0, true) // sizeofcmds
    const slice = parseMachO(bytes).slices[0]
    expect(slice?.is64).toBe(false)
    expect(slice?.headerSize).toBe(28)
  })
})

describe('parseMachO errors', () => {
  it('rejects non-Mach-O input', () => {
    expectCode(
      () => parseMachO(new Uint8Array([1, 2, 3])),
      ErrorCode.InvalidMachO
    )
    expectCode(
      () => parseMachO(new TextEncoder().encode('PK\u0003\u0004 not a binary')),
      ErrorCode.InvalidMachO
    )
  })

  it('rejects truncated load commands', () => {
    const bytes = readFixture('inputs', 'thin-min14').slice(0, 40)
    expectCode(() => parseMachO(bytes), ErrorCode.InvalidMachO)
  })

  it('rejects a load command whose size runs past sizeofcmds', () => {
    const bytes = readFixture('inputs', 'thin-min14').slice()
    new DataView(bytes.buffer).setUint32(32 + 4, 0xffff, true) // first cmdsize
    expectCode(() => parseMachO(bytes), ErrorCode.InvalidMachO)
  })

  it('rejects fat slices pointing outside the file', () => {
    const bytes = readFixture('inputs', 'fat').slice()
    new DataView(bytes.buffer).setUint32(8 + 12, 0x7fffffff, false) // first arch size
    expectCode(() => parseMachO(bytes), ErrorCode.InvalidMachO)
  })

  it('reports fat_arch_64 as unsupported', () => {
    const bytes = new Uint8Array(64)
    new DataView(bytes.buffer).setUint32(0, 0xcafebabf, false)
    expectCode(() => parseMachO(bytes), ErrorCode.UnsupportedArch)
  })
})

describe('isMachO', () => {
  it('recognises thin and fat binaries only', () => {
    expect(isMachO(readFixture('inputs', 'thin-min14'))).toBe(true)
    expect(isMachO(readFixture('inputs', 'fat'))).toBe(true)
    expect(isMachO(readFixture('inputs', 'Test.app', 'Info.plist'))).toBe(false)
    const magic = new Uint8Array(4)
    new DataView(magic.buffer).setUint32(0, MH_MAGIC_64, true)
    expect(isMachO(magic)).toBe(true)
  })
})

describe('versions', () => {
  it('packs, parses and formats', () => {
    expect(packVersion(16, 4, 1)).toBe(0x100401)
    expect(parseVersion('14.0')).toBe(packVersion(14))
    expect(parseVersion('10')).toBe(packVersion(10))
    expect(formatVersion(packVersion(16, 4, 1))).toBe('16.4.1')
    expect(formatVersion(packVersion(14))).toBe('14.0')
  })
})

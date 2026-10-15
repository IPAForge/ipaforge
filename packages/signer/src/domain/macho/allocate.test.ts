import { describe, expect, it } from 'vitest'

import { ErrorCode, LoadstarError, toHex } from '@loadstar/kernel'
import { readFixture } from '@signer/__tests__/fixtures.ts'
import { signedTargets } from '@signer/__tests__/targets.ts'
import {
  CSSLOT_ALTERNATE_CODEDIRECTORIES,
  CSSLOT_CODEDIRECTORY,
  CSSLOT_DER_ENTITLEMENTS,
  CSSLOT_ENTITLEMENTS,
  CSSLOT_REQUIREMENTS,
  findBlob,
  parseCodeDirectory,
  parseSuperBlob
} from '@signer/domain/blobs/index.ts'
import { DEFAULT_SIGNING_POLICY } from '@signer/domain/config.ts'
import {
  estimateSignatureSize,
  prepareImage
} from '@signer/domain/macho/allocate.ts'
import { assembleFat } from '@signer/domain/macho/fat.ts'
import { parseMachO } from '@signer/domain/macho/parse.ts'

const firstDiff = (a: Uint8Array, b: Uint8Array): number => {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i
  return a.length === b.length ? -1 : n
}

describe.each(signedTargets().map((t) => [t.label, t] as const))(
  'allocation for %s',
  (_label, target) => {
    const input = parseMachO(readFixture('inputs', ...target.binary))
    const expected = parseMachO(readFixture('expected', ...target.binary))

    it.each(input.slices.map((slice, i) => [i, slice] as const))(
      'slice %i matches codesign_allocate',
      (i, slice) => {
        const appleSlice = expected.slices[i]
        const appleSig = appleSlice?.codeSignature
        if (!appleSlice || !appleSig)
          throw new Error('expected fixture must be signed')

        // feed the estimator exactly what codesign emitted for this slice
        const blobs = parseSuperBlob(
          appleSlice.bytes.subarray(
            appleSig.dataoff,
            appleSig.dataoff + appleSig.datasize
          )
        )
        const pieces = [
          CSSLOT_REQUIREMENTS,
          CSSLOT_ENTITLEMENTS,
          CSSLOT_DER_ENTITLEMENTS
        ]
          .map((slot) => findBlob(blobs, slot))
          .filter((blob): blob is Uint8Array => blob !== undefined)
        const codeDirectories = [
          CSSLOT_CODEDIRECTORY,
          CSSLOT_ALTERNATE_CODEDIRECTORIES
        ]
          .map((slot) => findBlob(blobs, slot))
          .filter((blob): blob is Uint8Array => blob !== undefined)
          .map(parseCodeDirectory)
          .map((cd) => ({
            identifierLength: new TextEncoder().encode(cd.identifier).length,
            teamIdLength: cd.teamId?.length ?? 0,
            pageSize: cd.pageSize,
            hashSize: cd.hashSize,
            nSpecialSlots: cd.nSpecialSlots
          }))

        const datasize = estimateSignatureSize(slice, {
          pieces,
          codeDirectories,
          cmsReservation: DEFAULT_SIGNING_POLICY.cmsReservation
        })
        expect(datasize).toBe(appleSig.datasize)

        const prepared = prepareImage(slice, datasize)
        expect(prepared.codeLimit).toBe(appleSig.dataoff)
        expect(prepared.image.byteLength).toBe(appleSlice.bytes.byteLength)
        expect(prepared.addedLoadCommand).toBe(
          slice.codeSignature === undefined
        )

        // everything the CodeDirectory hashes (header, load commands, code, padding) is identical to Apple's
        const ours = prepared.image.subarray(0, prepared.codeLimit)
        const apple = appleSlice.bytes.subarray(0, appleSig.dataoff)
        expect(firstDiff(ours, apple)).toBe(-1)
      }
    )
  }
)

describe('fat reassembly', () => {
  it('rebuilds the universal fixture byte-for-byte from its slices', () => {
    const bytes = readFixture('expected', 'fat')
    const file = parseMachO(bytes)
    const rebuilt = assembleFat(
      file.fat ?? [],
      file.slices.map((slice) => slice.bytes)
    )
    expect(toHex(rebuilt)).toBe(toHex(bytes))
  })

  it("aligns slices of different sizes to each arch's alignment", () => {
    const arches = [
      { cputype: 12, cpusubtype: 9, offset: 0, size: 0, align: 14 },
      { cputype: 0x0100000c, cpusubtype: 0, offset: 0, size: 0, align: 14 }
    ]
    const out = assembleFat(arches, [
      new Uint8Array(100).fill(1),
      new Uint8Array(50).fill(2)
    ])
    const reparsedOffsets = [0, 1].map((i) =>
      new DataView(out.buffer).getUint32(8 + i * 20 + 8, false)
    )
    expect(reparsedOffsets).toEqual([0x4000, 0x8000])
    expect(out[0x4000]).toBe(1)
    expect(out[0x8000]).toBe(2)
    expect(out.byteLength).toBe(0x8000 + 50)
  })
})

describe('allocation errors', () => {
  it('refuses binaries without header room for a new load command', () => {
    const slice = parseMachO(readFixture('inputs', 'thin-min14')).slices[0]
    if (!slice) throw new Error('fixture')
    const cramped = {
      ...slice,
      firstSectionOffset: slice.headerSize + slice.sizeofcmds + 8
    }
    try {
      prepareImage(cramped, 1024)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(LoadstarError)
      expect((error as LoadstarError).code).toBe(ErrorCode.NoHeaderSpace)
    }
  })

  it('refuses a signature that runs past __LINKEDIT', () => {
    const slice = parseMachO(readFixture('expected', 'thin-min14')).slices[0]
    if (!slice?.codeSignature) throw new Error('fixture')
    const broken = {
      ...slice,
      codeSignature: { ...slice.codeSignature, datasize: 1 << 24 }
    }
    expect(() => prepareImage(broken, 1024)).toThrow(LoadstarError)
  })
})

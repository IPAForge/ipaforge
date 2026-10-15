import { describe, expect, it } from 'vitest'

import { readFixture } from '@signer/__tests__/fixtures.ts'
import {
  architectureOf,
  architecturesOf
} from '@signer/domain/macho/architecture.ts'
import {
  Architecture,
  CPU_SUBTYPE_ARM_V7,
  CPU_SUBTYPE_ARM_V7S,
  CPU_SUBTYPE_ARM64_ALL,
  CPU_SUBTYPE_ARM64E,
  CPU_SUBTYPE_X86_64_ALL,
  CPU_TYPE_ARM,
  CPU_TYPE_ARM64,
  CPU_TYPE_X86_64
} from '@signer/domain/macho/constants.ts'

/** arm64e with the pointer-authentication ABI capability bit set, as the parser reads it (a signed int32). */
const ARM64E_WITH_PTRAUTH_ABI = 0x80000002 | 0

describe('architectureOf', () => {
  it.each([
    [CPU_TYPE_ARM64, CPU_SUBTYPE_ARM64_ALL, Architecture.Arm64],
    [CPU_TYPE_ARM64, CPU_SUBTYPE_ARM64E, Architecture.Arm64e],
    [CPU_TYPE_ARM64, ARM64E_WITH_PTRAUTH_ABI, Architecture.Arm64e],
    [CPU_TYPE_ARM, CPU_SUBTYPE_ARM_V7, Architecture.Armv7],
    [CPU_TYPE_ARM, CPU_SUBTYPE_ARM_V7S, Architecture.Armv7s],
    [CPU_TYPE_X86_64, CPU_SUBTYPE_X86_64_ALL, Architecture.X86_64],
    [CPU_TYPE_ARM, 99, 'cpu 12/99']
  ])('cputype %i / subtype %i is %s', (cputype, cpusubtype, expected) => {
    expect(architectureOf(cputype, cpusubtype)).toBe(expected)
  })
})

describe('architecturesOf', () => {
  it('names every slice of a universal binary', () => {
    expect(architecturesOf(readFixture('inputs', 'fat'))).toEqual([
      Architecture.Arm64,
      Architecture.Arm64e
    ])
  })

  it('names the one slice of a thin binary', () => {
    expect(architecturesOf(readFixture('inputs', 'thin-min14'))).toEqual([
      Architecture.Arm64
    ])
  })

  it('reports none for bytes that are not Mach-O', () => {
    expect(architecturesOf(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toEqual(
      []
    )
  })
})

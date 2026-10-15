// Names a Mach-O slice's CPU (cputype + cpusubtype) the way `lipo` does.
import {
  DEFAULT_SIGNER_LIMITS,
  type MachOLimits
} from '@signer/domain/config.ts'
import {
  Architecture,
  CPU_SUBTYPE_ARM_V6,
  CPU_SUBTYPE_ARM_V7,
  CPU_SUBTYPE_ARM_V7K,
  CPU_SUBTYPE_ARM_V7S,
  CPU_SUBTYPE_ARM64_32_V8,
  CPU_SUBTYPE_ARM64_ALL,
  CPU_SUBTYPE_ARM64_V8,
  CPU_SUBTYPE_ARM64E,
  CPU_SUBTYPE_MASK,
  CPU_SUBTYPE_X86_64_ALL,
  CPU_TYPE_ARM,
  CPU_TYPE_ARM64,
  CPU_TYPE_ARM64_32,
  CPU_TYPE_X86_64
} from '@signer/domain/macho/constants.ts'
import { parseMachO } from '@signer/domain/macho/parse.ts'

const KNOWN: readonly (readonly [
  cputype: number,
  cpusubtype: number,
  name: Architecture
])[] = [
  [CPU_TYPE_ARM64, CPU_SUBTYPE_ARM64_ALL, Architecture.Arm64],
  [CPU_TYPE_ARM64, CPU_SUBTYPE_ARM64_V8, Architecture.Arm64],
  [CPU_TYPE_ARM64, CPU_SUBTYPE_ARM64E, Architecture.Arm64e],
  [CPU_TYPE_ARM64_32, CPU_SUBTYPE_ARM64_32_V8, Architecture.Arm64_32],
  [CPU_TYPE_ARM, CPU_SUBTYPE_ARM_V6, Architecture.Armv6],
  [CPU_TYPE_ARM, CPU_SUBTYPE_ARM_V7, Architecture.Armv7],
  [CPU_TYPE_ARM, CPU_SUBTYPE_ARM_V7S, Architecture.Armv7s],
  [CPU_TYPE_ARM, CPU_SUBTYPE_ARM_V7K, Architecture.Armv7k],
  [CPU_TYPE_X86_64, CPU_SUBTYPE_X86_64_ALL, Architecture.X86_64]
]

/** `lipo`'s name for the CPU, or `cpu <type>/<subtype>` for one it does not know. */
export const architectureOf = (cputype: number, cpusubtype: number): string => {
  const subtype = cpusubtype & ~CPU_SUBTYPE_MASK
  const known = KNOWN.find(([type, sub]) => type === cputype && sub === subtype)

  return known ? known[2] : `cpu ${cputype}/${subtype}`
}

/** The architecture of every slice of a Mach-O file; none when the bytes are not a usable Mach-O. */
export const architecturesOf = (
  bytes: Uint8Array,
  limits: MachOLimits = DEFAULT_SIGNER_LIMITS.machO
): string[] => {
  try {
    return parseMachO(bytes, limits).slices.map((slice) =>
      architectureOf(slice.cputype, slice.cpusubtype)
    )
  } catch {
    return []
  }
}

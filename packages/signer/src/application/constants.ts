import {
  CS_EXECSEG_ALLOW_UNSIGNED,
  CS_EXECSEG_CAN_EXEC_CDHASH,
  CS_EXECSEG_CAN_LOAD_CDHASH,
  CS_EXECSEG_DEBUGGER,
  CS_EXECSEG_JIT,
  CS_EXECSEG_SKIP_LV
} from '@signer/domain/blobs/index.ts'
import { Platform } from '@signer/domain/macho/constants.ts'
import { packVersion } from '@signer/domain/macho/version.ts'

/**
 * Per platform, the deployment target below which a slice also needs a SHA-1 CodeDirectory
 * (apple/machorep.cpp; watchOS per signer-spec §2.3). Platforms not listed never do.
 */
export const SHA1_REQUIRED_BELOW: Readonly<Partial<Record<number, number>>> = {
  [Platform.IOS]: packVersion(11),
  [Platform.TvOS]: packVersion(11),
  [Platform.MacOS]: packVersion(10, 11, 4),
  [Platform.WatchOS]: packVersion(12)
}

/**
 * Per platform, the deployment target below which an arm64 slice uses 4 KiB code pages
 * (apple/machorep_120.cpp): tvOS always does; platforms not listed use 16 KiB.
 */
export const SMALL_PAGES_BELOW: Readonly<Partial<Record<number, number>>> = {
  [Platform.TvOS]: Number.POSITIVE_INFINITY,
  [Platform.IOS]: packVersion(16),
  [Platform.WatchOS]: packVersion(9)
}

/** Entitlements that set CodeDirectory exec-segment flags when `true`. */
export const EXEC_SEG_ENTITLEMENT_FLAGS: readonly [string, bigint][] = [
  ['get-task-allow', CS_EXECSEG_ALLOW_UNSIGNED],
  ['run-unsigned-code', CS_EXECSEG_ALLOW_UNSIGNED],
  ['com.apple.private.cs.debugger', CS_EXECSEG_DEBUGGER],
  ['dynamic-codesigning', CS_EXECSEG_JIT],
  ['com.apple.private.skip-library-validation', CS_EXECSEG_SKIP_LV],
  ['com.apple.private.amfi.can-load-cdhash', CS_EXECSEG_CAN_LOAD_CDHASH],
  ['com.apple.private.amfi.can-execute-cdhash', CS_EXECSEG_CAN_EXEC_CDHASH]
]

/** Special-slot number of each `SpecialSlotData` field. */
export const NSPECIAL = {
  infoPlist: 1,
  requirements: 2,
  codeResources: 3,
  entitlements: 5,
  derEntitlements: 7
} as const

/** Path segments that would leave the bundle or name it ambiguously. */
export const UNSAFE_SEGMENTS = new Set(['', '.', '..'])

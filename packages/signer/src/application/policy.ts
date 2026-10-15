import type { PlistDict } from '@loadstar/kernel'
import {
  CS_EXECSEG_ALLOW_UNSIGNED,
  CS_EXECSEG_CAN_EXEC_CDHASH,
  CS_EXECSEG_CAN_LOAD_CDHASH,
  CS_EXECSEG_DEBUGGER,
  CS_EXECSEG_JIT,
  CS_EXECSEG_MAIN_BINARY,
  CS_EXECSEG_SKIP_LV,
  CS_PAGE_SIZE_4K,
  CS_PAGE_SIZE_16K
} from '@signer/domain/blobs/index.ts'
import type { HashPolicy, PageSizePolicy } from '@signer/domain/config.ts'
import {
  CPU_TYPE_ARM64,
  CPU_TYPE_ARM64_32,
  MH_EXECUTE,
  Platform
} from '@signer/domain/macho/constants.ts'
import type { Slice } from '@signer/domain/macho/types.ts'
import { packVersion } from '@signer/domain/macho/version.ts'
import type { HashAlgorithm } from '@signer/domain/ports/hasher.ts'

/**
 * SHA-1 + SHA-256 ("agile") when any slice targets an OS too old for SHA-256-only signatures;
 * the decision applies to the whole file (apple/machorep.cpp).
 */
export const hashAlgorithmsFor = (
  slices: readonly Slice[],
  policy: HashPolicy = 'codesign'
): readonly HashAlgorithm[] => {
  if (policy !== 'codesign') return policy
  const needsSha1 = slices.some((slice) => {
    const build = slice.buildVersion
    if (!build) return false
    switch (build.platform) {
      case Platform.IOS:
      case Platform.TvOS:
        return build.minOS < packVersion(11)
      case Platform.MacOS:
        return build.minOS < packVersion(10, 11, 4)
      case Platform.WatchOS:
        return build.minOS < packVersion(12) // per signer-spec §2.3 (apple/machorep.cpp)
      default:
        return false
    }
  })

  return needsSha1 ? ['sha1', 'sha256'] : ['sha256']
}

/** Code page size codesign 26.x picks for a slice (apple/machorep_120.cpp). */
export const pageSizeFor = (
  slice: Slice,
  policy: PageSizePolicy = 'codesign'
): number => {
  if (policy !== 'codesign') return policy
  if (slice.cputype !== CPU_TYPE_ARM64 && slice.cputype !== CPU_TYPE_ARM64_32)
    return CS_PAGE_SIZE_4K
  const build = slice.buildVersion
  switch (build?.platform) {
    case Platform.TvOS:
      return CS_PAGE_SIZE_4K
    case Platform.IOS:
      return build.minOS < packVersion(16) ? CS_PAGE_SIZE_4K : CS_PAGE_SIZE_16K
    case Platform.WatchOS:
      return build.minOS < packVersion(9) ? CS_PAGE_SIZE_4K : CS_PAGE_SIZE_16K
    default:
      return CS_PAGE_SIZE_16K
  }
}

const EXEC_SEG_ENTITLEMENT_FLAGS: readonly [string, bigint][] = [
  ['get-task-allow', CS_EXECSEG_ALLOW_UNSIGNED],
  ['run-unsigned-code', CS_EXECSEG_ALLOW_UNSIGNED],
  ['com.apple.private.cs.debugger', CS_EXECSEG_DEBUGGER],
  ['dynamic-codesigning', CS_EXECSEG_JIT],
  ['com.apple.private.skip-library-validation', CS_EXECSEG_SKIP_LV],
  ['com.apple.private.amfi.can-load-cdhash', CS_EXECSEG_CAN_LOAD_CDHASH],
  ['com.apple.private.amfi.can-execute-cdhash', CS_EXECSEG_CAN_EXEC_CDHASH]
]

/** CodeDirectory exec-segment flags: MAIN_BINARY for executables plus entitlement-driven bits. */
export const execSegmentFlags = (
  slice: Slice,
  entitlements: PlistDict | undefined
): bigint => {
  let flags = slice.filetype === MH_EXECUTE ? CS_EXECSEG_MAIN_BINARY : 0n
  for (const [key, flag] of EXEC_SEG_ENTITLEMENT_FLAGS)
    if (entitlements?.[key] === true) flags |= flag
  return flags
}

/** Only executables carry entitlement blobs (codesign `mainBinary` rule). */
export const carriesEntitlements = (slice: Slice): boolean =>
  slice.filetype === MH_EXECUTE

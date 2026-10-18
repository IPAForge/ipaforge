import type { PlistDict } from '@ipaforge/kernel'
import {
  EXEC_SEG_ENTITLEMENT_FLAGS,
  SHA1_REQUIRED_BELOW,
  SMALL_PAGES_BELOW
} from '@signer/application/constants.ts'
import {
  CS_EXECSEG_MAIN_BINARY,
  CS_PAGE_SIZE_4K,
  CS_PAGE_SIZE_16K
} from '@signer/domain/blobs/index.ts'
import {
  CPU_TYPE_ARM64,
  CPU_TYPE_ARM64_32,
  MH_EXECUTE
} from '@signer/domain/macho/constants.ts'
import type { Slice } from '@signer/domain/macho/types.ts'
import type { HashAlgorithm } from '@signer/domain/ports/types.ts'
import type { HashPolicy, PageSizePolicy } from '@signer/domain/types.ts'

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
    const sha1Below = SHA1_REQUIRED_BELOW[build.platform]

    return sha1Below !== undefined && build.minOS < sha1Below
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
  const smallBelow = build && SMALL_PAGES_BELOW[build.platform]
  if (build === undefined || smallBelow === undefined) return CS_PAGE_SIZE_16K
  return build.minOS < smallBelow ? CS_PAGE_SIZE_4K : CS_PAGE_SIZE_16K
}

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

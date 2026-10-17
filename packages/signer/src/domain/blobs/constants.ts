// Code-signing blob constants (names match xnu osfmk/kern/cs_blobs.h). All blobs are big-endian.

import type { HashAlgorithm } from '@signer/domain/ports/types.ts'

export const CSMAGIC_REQUIREMENT = 0xfade0c00
export const CSMAGIC_REQUIREMENTS = 0xfade0c01
export const CSMAGIC_CODEDIRECTORY = 0xfade0c02
export const CSMAGIC_EMBEDDED_SIGNATURE = 0xfade0cc0
export const CSMAGIC_EMBEDDED_ENTITLEMENTS = 0xfade7171
export const CSMAGIC_EMBEDDED_DER_ENTITLEMENTS = 0xfade7172
export const CSMAGIC_BLOBWRAPPER = 0xfade0b01

/** SuperBlob slot types. */
export const CSSLOT_CODEDIRECTORY = 0
export const CSSLOT_INFOSLOT = 1
export const CSSLOT_REQUIREMENTS = 2
export const CSSLOT_RESOURCEDIR = 3
export const CSSLOT_ENTITLEMENTS = 5
export const CSSLOT_DER_ENTITLEMENTS = 7
export const CSSLOT_ALTERNATE_CODEDIRECTORIES = 0x1000
export const CSSLOT_SIGNATURESLOT = 0x10000

/** CodeDirectory flags. */
export const CS_ADHOC = 0x2

/** CodeDirectory exec-segment flags. */
export const CS_EXECSEG_MAIN_BINARY = 0x1n
export const CS_EXECSEG_ALLOW_UNSIGNED = 0x10n
export const CS_EXECSEG_DEBUGGER = 0x20n
export const CS_EXECSEG_JIT = 0x40n
export const CS_EXECSEG_SKIP_LV = 0x80n
export const CS_EXECSEG_CAN_LOAD_CDHASH = 0x100n
export const CS_EXECSEG_CAN_EXEC_CDHASH = 0x200n

/** CodeDirectory hash types. */
export const CS_HASHTYPE_SHA1 = 1
export const CS_HASHTYPE_SHA256 = 2

/** Code page sizes the kernel accepts. */
export const CS_PAGE_SIZE_4K = 4096
export const CS_PAGE_SIZE_16K = 16384

/** cdhash length (CS_CDHASH_LEN). */
export const CS_CDHASH_LEN = 20

export const CS_SUPPORTSSCATTER = 0x20100
export const CS_SUPPORTSTEAMID = 0x20200
export const CS_SUPPORTSCODELIMIT64 = 0x20300
export const CS_SUPPORTSEXECSEG = 0x20400

/** CodeDirectory `hashType` of each hash algorithm. */
export const HASH_TYPE: Readonly<Record<HashAlgorithm, number>> = {
  sha1: CS_HASHTYPE_SHA1,
  sha256: CS_HASHTYPE_SHA256
}

/** CodeDirectory fixed-header size for each version. */
export const FIXED_HEADER_SIZE: Readonly<Record<number, number>> = {
  [CS_SUPPORTSSCATTER]: 48,
  [CS_SUPPORTSTEAMID]: 52,
  [CS_SUPPORTSCODELIMIT64]: 64,
  [CS_SUPPORTSEXECSEG]: 88
}

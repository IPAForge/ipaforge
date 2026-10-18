import type { PlistLimits } from '@ipaforge/kernel'
import type { HashAlgorithm } from '@signer/domain/ports/types.ts'

export type MachOLimits = {
  /** Maximum slices in a universal binary (real files have at most a handful). */
  readonly maxFatArches: number
}

export type ArchiveLimits = {
  readonly maxEntries: number
  /** Total uncompressed bytes an archive may expand to. */
  readonly maxUncompressedBytes: number
}

/** Resource limits protecting against hostile inputs. */
export type SignerLimits = {
  readonly plist: PlistLimits
  readonly machO: MachOLimits
  readonly ipa: ArchiveLimits
}

/**
 * Code page size: `"codesign"` follows Apple codesign 26 (16 KiB for arm64 iOS ≥ 16, else 4 KiB);
 * a number forces that size (the kernel accepts 4096 and 16384).
 */
export type PageSizePolicy = 'codesign' | 4096 | 16384

/**
 * CodeDirectory hash algorithms: `"codesign"` follows Apple (SHA-256, plus SHA-1 for old deployment
 * targets); a list forces exactly those, primary first.
 */
export type HashPolicy = 'codesign' | readonly HashAlgorithm[]

export type SigningPolicy = {
  readonly pageSize: PageSizePolicy
  readonly hashAlgorithms: HashPolicy
  /** Bytes reserved for the CMS blob when sizing the signature (codesign uses 18000). */
  readonly cmsReservation: number
}

/** Recursively optional, for override objects. */
export type Overrides<T> = {
  readonly [K in keyof T]?: T[K] extends object ? Overrides<T[K]> : T[K]
}

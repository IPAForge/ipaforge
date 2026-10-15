// Every tunable of the signer in one place, with the defaults the engine ships with. Callers override any
// subset (e.g. `signIpa(source, { limits: { plist: { maxDepth: 32 } } })`); nothing here is a format
// constant (those live in the *constants.ts / oids.ts / layout.ts modules and must not change).
import { DEFAULT_PLIST_LIMITS, type PlistLimits } from "@loadstar/kernel";
import type { HashAlgorithm } from "@signer/domain/ports/hasher.ts";

export type { PlistLimits };

export interface MachOLimits {
  /** Maximum slices in a universal binary (real files have at most a handful). */
  readonly maxFatArches: number;
}

export interface ArchiveLimits {
  readonly maxEntries: number;
  /** Total uncompressed bytes an archive may expand to. */
  readonly maxUncompressedBytes: number;
}

/** Resource limits protecting against hostile inputs. */
export interface SignerLimits {
  readonly plist: PlistLimits;
  readonly machO: MachOLimits;
  readonly ipa: ArchiveLimits;
}

export const DEFAULT_SIGNER_LIMITS: SignerLimits = {
  plist: DEFAULT_PLIST_LIMITS,
  machO: { maxFatArches: 16 },
  ipa: { maxEntries: 200_000, maxUncompressedBytes: 4 * 1024 ** 3 },
};

/**
 * Code page size: `"codesign"` follows Apple codesign 26 (16 KiB for arm64 iOS ≥ 16, else 4 KiB);
 * a number forces that size (the kernel accepts 4096 and 16384).
 */
export type PageSizePolicy = "codesign" | 4096 | 16384;

/**
 * CodeDirectory hash algorithms: `"codesign"` follows Apple (SHA-256, plus SHA-1 for old deployment
 * targets); a list forces exactly those, primary first.
 */
export type HashPolicy = "codesign" | readonly HashAlgorithm[];

export interface SigningPolicy {
  readonly pageSize: PageSizePolicy;
  readonly hashAlgorithms: HashPolicy;
  /** Bytes reserved for the CMS blob when sizing the signature (codesign uses 18000). */
  readonly cmsReservation: number;
}

export const DEFAULT_SIGNING_POLICY: SigningPolicy = {
  pageSize: "codesign",
  hashAlgorithms: "codesign",
  cmsReservation: 18_000,
};

/** Recursively optional, for override objects. */
export type Overrides<T> = { readonly [K in keyof T]?: T[K] extends object ? Overrides<T[K]> : T[K] };

export const resolveLimits = (overrides: Overrides<SignerLimits> = {}): SignerLimits => ({
  plist: { ...DEFAULT_SIGNER_LIMITS.plist, ...overrides.plist },
  machO: { ...DEFAULT_SIGNER_LIMITS.machO, ...overrides.machO },
  ipa: { ...DEFAULT_SIGNER_LIMITS.ipa, ...overrides.ipa },
});

export const resolvePolicy = (overrides: Partial<SigningPolicy> = {}): SigningPolicy => ({
  ...DEFAULT_SIGNING_POLICY,
  ...overrides,
});

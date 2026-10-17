// Every tunable of the signer in one place, with the defaults the engine ships with. Callers override any
// subset (e.g. `signIpa(source, { limits: { plist: { maxDepth: 32 } } })`); nothing here is a format
// constant (those live in the *constants.ts / oids.ts / layout.ts modules and must not change).
import { DEFAULT_PLIST_LIMITS, type PlistLimits } from '@loadstar/kernel'
import type {
  Overrides,
  SignerLimits,
  SigningPolicy
} from '@signer/domain/types.ts'

export type { PlistLimits }

export const DEFAULT_SIGNER_LIMITS: SignerLimits = {
  plist: DEFAULT_PLIST_LIMITS,
  machO: { maxFatArches: 16 },
  ipa: { maxEntries: 200_000, maxUncompressedBytes: 4 * 1024 ** 3 }
}

export const DEFAULT_SIGNING_POLICY: SigningPolicy = {
  pageSize: 'codesign',
  hashAlgorithms: 'codesign',
  cmsReservation: 18_000
}

export const resolveLimits = (
  overrides: Overrides<SignerLimits> = {}
): SignerLimits => ({
  plist: { ...DEFAULT_SIGNER_LIMITS.plist, ...overrides.plist },
  machO: { ...DEFAULT_SIGNER_LIMITS.machO, ...overrides.machO },
  ipa: { ...DEFAULT_SIGNER_LIMITS.ipa, ...overrides.ipa }
})

export const resolvePolicy = (
  overrides: Partial<SigningPolicy> = {}
): SigningPolicy => ({
  ...DEFAULT_SIGNING_POLICY,
  ...overrides
})

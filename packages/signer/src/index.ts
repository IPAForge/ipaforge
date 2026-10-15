// Public API of @loadstar/signer. Everything else is internal.

export {
  createDict,
  isPlistDict,
  type PlistDict,
  PlistReal,
  type PlistValue,
  parsePlist,
  real,
  serializeXmlPlist,
} from "@loadstar/kernel";
export type { BundleAddition, BundleAdditions } from "@signer/application/bundle-additions.ts";
export { embeddedEntitlements } from "@signer/application/embedded-entitlements.ts";
export {
  type BundleProvisioning,
  type ReconcileOptions,
  type ReconcileResult,
  reconcileForSideload,
} from "@signer/application/reconcile.ts";
export { type SignBinaryOptions, type SignedBinary, signBinary } from "@signer/application/sign-binary.ts";
export {
  type BundleSigningConfig,
  canonicalIdentifier,
  type SignBundleOptions,
  type SignBundleProgress,
  type SignedBundleSummary,
  signBundle,
} from "@signer/application/sign-bundle.ts";
export {
  type ArchiveOptions,
  type SignedIpa,
  type SignerProgress,
  type SignIpaDeps,
  type SignIpaOptions,
  type SignIpaSummary,
  signIpa,
} from "@signer/application/sign-ipa.ts";
export type { EntitlementsInput, SigningMode } from "@signer/application/signing.ts";
export { defaultSignerDeps, resolveDeps, type SignerDeps } from "@signer/deps.ts";
export type { DesignatedRequirement } from "@signer/domain/blobs/index.ts";
export { type CodeBundle, discoverBundles } from "@signer/domain/bundle/discover.ts";
export type { BundleTree, TreeEntry } from "@signer/domain/bundle/tree.ts";
export {
  type ArchiveLimits,
  DEFAULT_SIGNER_LIMITS,
  DEFAULT_SIGNING_POLICY,
  type HashPolicy,
  type MachOLimits,
  type Overrides,
  type PageSizePolicy,
  type PlistLimits,
  resolveLimits,
  resolvePolicy,
  type SignerLimits,
  type SigningPolicy,
} from "@signer/domain/config.ts";
export type { HashAlgorithm, Hasher } from "@signer/domain/ports/hasher.ts";
export {
  APPLE_CERTIFICATES,
  type CertificateInfo,
  type ChainResolution,
  certificateInfo,
  expiringAppleCertificates,
  type IssuerFetcher,
  type ResolveChainOptions,
  resolveChain,
  type SigningIdentity,
} from "@signer/infrastructure/cms/index.ts";
export { createHasher, type WebCryptoHasherOptions } from "@signer/infrastructure/hashing/index.ts";
export {
  DEFAULT_DROPPED_MEMBERS,
  DEFAULT_ENTRY_DATE,
  DEFAULT_STORED_EXTENSIONS,
  type Ipa,
  type ReadIpaOptions,
  readIpa,
  type WriteIpaOptions,
  writeIpa,
} from "@signer/infrastructure/ipa/index.ts";
export { exportPkcs12, type Pkcs12Input } from "@signer/infrastructure/pkcs12/index.ts";
export { type ProvisioningProfile, parseProvisioningProfile } from "@signer/infrastructure/profile/profile.ts";

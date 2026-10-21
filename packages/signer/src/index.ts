// Public API of @ipaforge/signer. Everything else is internal.

export {
  createDict,
  isPlistDict,
  type PlistDict,
  PlistReal,
  type PlistValue,
  parsePlist,
  real,
  serializeXmlPlist
} from '@ipaforge/kernel'
export { embeddedEntitlements } from '@signer/application/embedded-entitlements.ts'
export {
  type InspectIpaOptions,
  inspectIpa
} from '@signer/application/inspect-ipa.ts'
export { reconcileForSideload } from '@signer/application/reconcile.ts'
export { signBinary } from '@signer/application/sign-binary.ts'
export {
  canonicalIdentifier,
  signBundle
} from '@signer/application/sign-bundle.ts'
export { signIpa } from '@signer/application/sign-ipa.ts'
export type {
  ArchiveOptions,
  BundleAddition,
  BundleAdditions,
  BundleProvisioning,
  BundleSigningConfig,
  EntitlementsInput,
  ReconcileOptions,
  ReconcileResult,
  SignBinaryOptions,
  SignBundleOptions,
  SignBundleProgress,
  SignedBinary,
  SignedBundleSummary,
  SignedIpa,
  SignerProgress,
  SignIpaDeps,
  SignIpaOptions,
  SignIpaSummary,
  SigningMode
} from '@signer/application/types.ts'
export { defaultSignerDeps, resolveDeps } from '@signer/deps.ts'
export type { DesignatedRequirement } from '@signer/domain/blobs/index.ts'
export { discoverBundles } from '@signer/domain/bundle/discover.ts'
export type {
  BundleTree,
  CodeBundle,
  TreeEntry
} from '@signer/domain/bundle/types.ts'
export {
  DEFAULT_SIGNER_LIMITS,
  DEFAULT_SIGNING_POLICY,
  type PlistLimits,
  resolveLimits,
  resolvePolicy
} from '@signer/domain/config.ts'
export type { HashAlgorithm, Hasher } from '@signer/domain/ports/types.ts'
export {
  assertCompatible,
  checkCompatibility
} from '@signer/domain/sideload/compatibility.ts'
export {
  DeviceClass,
  DeviceFamily
} from '@signer/domain/sideload/compatibility-constants.ts'
export { planSideloadIdentity } from '@signer/domain/sideload/identity-plan.ts'
export type {
  BundleIdentity,
  CompatibilityProblem,
  InspectedApp,
  InspectedBundle,
  IpaInspection,
  NestedBundleKind,
  SideloadIdentityPlan,
  TargetDevice
} from '@signer/domain/sideload/types.ts'
export type {
  ArchiveLimits,
  HashPolicy,
  MachOLimits,
  Overrides,
  PageSizePolicy,
  SignerLimits,
  SigningPolicy
} from '@signer/domain/types.ts'
export {
  APPLE_CERTIFICATES,
  type CertificateInfo,
  type ChainResolution,
  certificateInfo,
  expiringAppleCertificates,
  type IssuerFetcher,
  type ResolveChainOptions,
  resolveChain,
  type SigningIdentity
} from '@signer/infrastructure/cms/index.ts'
export {
  createHasher,
  type WebCryptoHasherOptions
} from '@signer/infrastructure/hashing/index.ts'
export {
  DEFAULT_DROPPED_MEMBERS,
  DEFAULT_ENTRY_DATE,
  DEFAULT_STORED_EXTENSIONS,
  type Ipa,
  type ReadIpaOptions,
  readIpa,
  type WriteIpaOptions,
  writeIpa
} from '@signer/infrastructure/ipa/index.ts'
export {
  exportPkcs12,
  importPkcs12,
  keyMatchesCertificate,
  type Pkcs12Contents,
  type Pkcs12Input
} from '@signer/infrastructure/pkcs12/index.ts'
export {
  type ProvisioningProfile,
  parseProvisioningProfile
} from '@signer/infrastructure/profile/profile.ts'
export type { SignerDeps } from '@signer/types.ts'

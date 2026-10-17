import type { Clock, Logger, PlistDict } from '@loadstar/kernel'
import type {
  DesignatedRequirement,
  SpecialSlotData
} from '@signer/domain/blobs/index.ts'
import type {
  BundleTree,
  CodeBundle,
  IdentityRewrite,
  LooseBinary
} from '@signer/domain/bundle/types.ts'
import type { HashAlgorithm, Hasher } from '@signer/domain/ports/types.ts'
import type {
  Overrides,
  SignerLimits,
  SigningPolicy
} from '@signer/domain/types.ts'
import type { SigningIdentity } from '@signer/infrastructure/cms/types.ts'
import type { Ipa } from '@signer/infrastructure/ipa/index.ts'
import type { ProvisioningProfile } from '@signer/infrastructure/profile/profile.ts'
import type { SigningDeps } from '@signer/types.ts'

/** Content to put into one bundle before it is signed, so the signature seals it. */
export type BundleAddition = {
  /** Bundle directory relative to the main app ("" = main app), as in `CodeBundle.path`. */
  readonly bundlePath: string
  /** Files to write, keyed by '/'-separated path relative to the bundle. Existing files are replaced. */
  readonly files?: ReadonlyMap<string, Uint8Array>
  /** Info.plist keys to set; existing values for these keys are replaced. */
  readonly infoPlist?: PlistDict
}

/**
 * Decides what to add, given the app's code bundles. Each bundle carries its **original** identifier
 * (before any sideload rewrite), so callers can recognise apps by the IDs they ship with.
 */
export type BundleAdditions = (
  bundles: readonly CodeBundle[]
) => readonly BundleAddition[]

export type BundleAdditionsContext = {
  readonly limits: SignerLimits
  readonly logger: Logger
  /** Original bundle ID → new bundle ID, when the app was prepared for sideloading. */
  readonly renamed?: ReadonlyMap<string, string>
}

export type ReconcileOptions = {
  readonly teamId: string
  /** New bundle ID for the main app (e.g. `com.SideStore.SideStore.TEAMID`). */
  readonly newMainBundleId: string
  /** Leaf certificate the app will be signed with; must be listed in every profile. */
  readonly certificate: Uint8Array
  /** Raw provisioning profiles keyed by the **new** bundle ID they provision. */
  readonly profiles: ReadonlyMap<string, Uint8Array>
  /** Old app group → new app group. */
  readonly appGroups?: ReadonlyMap<string, string>
  /** Target device; checked against each profile's ProvisionedDevices. */
  readonly deviceUdid?: string
  readonly now: Date
  /** Remove extensions/watch apps without a profile instead of failing. */
  readonly pruneUnprovisioned?: boolean
  /** Parser limits (defaults: DEFAULT_SIGNER_LIMITS). */
  readonly limits?: Overrides<SignerLimits>
}

export type BundleProvisioning = {
  readonly entitlements: EntitlementsInput
  readonly provisioningProfile: Uint8Array
  readonly profile: ProvisioningProfile
}

export type ReconcileResult = {
  /** Keyed by bundle path relative to the main app ("" = main app). */
  readonly provisioning: ReadonlyMap<string, BundleProvisioning>
  /** Old bundle ID → new bundle ID. */
  readonly bundleIds: ReadonlyMap<string, string>
  readonly pruned: readonly string[]
}

export type ReconcileTarget = {
  readonly bundleId: string
  readonly rawProfile: Uint8Array
  readonly rewrite: IdentityRewrite
  /** The main app's rewritten `ALTAppGroups`, listed in every nested bundle too. */
  readonly altAppGroups: readonly string[]
}

export type ReconcileContext = {
  readonly options: ReconcileOptions
  readonly limits: SignerLimits
  readonly logger: Logger
}

export type SignBinaryOptions = SignatureContent & {
  /** Page size, hash algorithms and CMS reservation (defaults follow Apple codesign 26). */
  readonly policy?: Partial<SigningPolicy>
  /** Parser limits for hostile-input protection (defaults: DEFAULT_SIGNER_LIMITS). */
  readonly limits?: Overrides<SignerLimits>
  readonly signal?: AbortSignal
}

export type SignedBinary = {
  readonly bytes: Uint8Array
  /** cdhash (20 bytes) of each slice's primary CodeDirectory. */
  readonly cdhashes: readonly Uint8Array[]
}

/** Per-bundle signing configuration, decided by the caller (e.g. from provisioning profiles). */
export type BundleSigningConfig = {
  readonly signing: SigningMode
  /** Entitlements for the bundle's executable (apps and appexes; ignored for frameworks). */
  readonly entitlements?: EntitlementsInput
  /** Raw provisioning profile written as `embedded.mobileprovision` before sealing. */
  readonly provisioningProfile?: Uint8Array
}

export type SignBundleProgress =
  | {
      readonly type: 'binary'
      readonly path: string
      readonly index: number
      readonly total: number
    }
  | {
      readonly type: 'bundle'
      readonly path: string
      readonly identifier: string
      readonly index: number
      readonly total: number
    }

export type SignBundleOptions = {
  readonly configFor: (bundle: CodeBundle) => BundleSigningConfig
  /** Identifier for loose Mach-O files (default: codesign's canonical file name, e.g. `libFoo`). */
  readonly looseIdentifier?: (path: string) => string
  readonly onProgress?: (event: SignBundleProgress) => void
  /** Page size, hash algorithms and CMS reservation (defaults follow Apple codesign 26). */
  readonly policy?: Partial<SigningPolicy>
  /** Parser limits (defaults: DEFAULT_SIGNER_LIMITS). */
  readonly limits?: Overrides<SignerLimits>
  readonly signal?: AbortSignal
}

export type SignedBundle = {
  readonly path: string
  readonly identifier: string
  readonly cdhash: Uint8Array
}

export type SignedBundleSummary = {
  readonly bundles: readonly SignedBundle[]
  readonly looseBinaries: number
}

export type WorkItem =
  | ({ readonly type: 'binary' } & LooseBinary)
  | { readonly type: 'bundle'; readonly bundle: CodeBundle }

/** Everything one signBundle call shares across its work items. */
export type BundleRun = {
  readonly tree: BundleTree
  readonly configs: ReadonlyMap<string, BundleSigningConfig>
  readonly looseIdentifier: (path: string) => string
  readonly limits: SignerLimits
  readonly policy: SigningPolicy
  /** Options passed through to every signBinary call. */
  readonly shared: {
    readonly policy: SigningPolicy
    readonly limits: SignerLimits
    readonly signal?: AbortSignal
  }
  readonly deps: SigningDeps
  readonly logger: Logger
}

export type SignerProgress =
  | { readonly stage: 'reading' }
  | { readonly stage: 'reconciling' }
  | ({ readonly stage: 'signing' } & SignBundleProgress)
  | { readonly stage: 'writing' }

export type SignIpaOptions = {
  readonly signing: SigningMode
  /**
   * Prepare for sideloading (new bundle IDs, profiles, profile entitlements). Without it the app is
   * re-signed in place, keeping each executable's existing entitlements.
   */
  readonly sideload?: Omit<ReconcileOptions, 'now'>
  /** Files and Info.plist keys to put into bundles after reconciliation and before signing, so they are sealed. */
  readonly additions?: BundleAdditions
  readonly onProgress?: (progress: SignerProgress) => void
  readonly signal?: AbortSignal
  /** Page size, hash algorithms and CMS reservation (defaults follow Apple codesign 26). */
  readonly policy?: Partial<SigningPolicy>
  /** Hostile-input limits for plists, Mach-O and the archive (defaults: DEFAULT_SIGNER_LIMITS). */
  readonly limits?: Overrides<SignerLimits>
  /** Archive handling (defaults: store-only output, DEFAULT_DROPPED_MEMBERS, DEFAULT_STORED_EXTENSIONS). */
  readonly archive?: ArchiveOptions
}

export type ArchiveOptions = {
  /** Deflate level for the output, 0–9 (default 0 = store; fastest, fine for device installs). */
  readonly compressionLevel?: number
  readonly storedExtensions?: RegExp
  readonly droppedMembers?: readonly RegExp[]
  readonly entryDate?: Date
}

export type SignIpaDeps = {
  readonly logger?: Logger
  readonly clock?: Clock
  readonly hasher?: Hasher
}

export type SignIpaSummary = {
  readonly appName: string
  readonly bundles: readonly {
    readonly path: string
    readonly identifier: string
    readonly cdhash: Uint8Array
  }[]
  readonly looseBinaries: number
  readonly reconciled: ReconcileResult | undefined
  readonly ms: number
}

export type SignedIpa = {
  /** The signed .ipa; consume it once (e.g. pipe to a file or upload). */
  readonly ipa: ReadableStream<Uint8Array>
  /** The signed app tree, for callers that install unpacked (no re-zip needed). */
  readonly app: Ipa
  readonly summary: SignIpaSummary
}

export type SignedSlice = {
  readonly bytes: Uint8Array
  /** cdhash (20 bytes) of the slice's primary CodeDirectory. */
  readonly cdhash: Uint8Array
}

export type EntitlementBlobs = {
  readonly dict: PlistDict
  /** Slot 5: the plist bytes, verbatim. */
  readonly xml: Uint8Array
  /** Slot 7: the DER encoding. */
  readonly der: Uint8Array
}

/** Everything decided about a slice's signature before any bytes are hashed. */
export type SlicePlan = {
  readonly identifier: string
  readonly teamId: string | undefined
  readonly flags: number
  readonly algorithms: readonly HashAlgorithm[]
  readonly pageSize: number
  readonly requirements: Uint8Array
  readonly entitlements: EntitlementBlobs | undefined
  readonly special: SpecialSlotData
}

/** How a binary is signed: ad-hoc (no identity) or with a certificate. */
export type SigningMode =
  | { readonly kind: 'adhoc' }
  | {
      readonly kind: 'identity'
      readonly identity: SigningIdentity
      /** Team ID written into every CodeDirectory (the certificate's OU for Apple certificates). */
      readonly teamId: string
      /** Designated requirement override; defaults to Apple's Development-certificate form. */
      readonly requirement?: (identifier: string) => DesignatedRequirement
    }

export type EntitlementsInput = {
  /** Exact plist bytes embedded in slot 5 (codesign embeds the file verbatim). */
  readonly bytes: Uint8Array
  readonly dict: PlistDict
}

/** What one Mach-O signature is made of, besides the binary itself. */
export type SignatureContent = {
  readonly identifier: string
  readonly signing: SigningMode
  readonly entitlements?: EntitlementsInput
  /** Bundle executables only: Info.plist bytes (slot −1) and CodeResources bytes (slot −3). */
  readonly infoPlist?: Uint8Array
  readonly codeResources?: Uint8Array
}

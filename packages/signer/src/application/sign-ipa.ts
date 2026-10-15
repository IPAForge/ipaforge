import { type Clock, compact, type FileSource, type Logger, toLoadstarError } from "@loadstar/kernel";
import { embeddedEntitlements } from "@signer/application/embedded-entitlements.ts";
import { type ReconcileOptions, type ReconcileResult, reconcileForSideload } from "@signer/application/reconcile.ts";
import { type BundleSigningConfig, type SignBundleProgress, signBundle } from "@signer/application/sign-bundle.ts";
import type { EntitlementsInput, SigningMode } from "@signer/application/signing.ts";
import { resolveDeps, type SigningDeps } from "@signer/deps.ts";
import { type CodeBundle, discoverBundles } from "@signer/domain/bundle/discover.ts";
import { type BundleTree, readFile } from "@signer/domain/bundle/tree.ts";
import { type Overrides, resolveLimits, type SignerLimits, type SigningPolicy } from "@signer/domain/config.ts";
import type { Hasher } from "@signer/domain/ports/hasher.ts";
import { createHasher } from "@signer/infrastructure/hashing/index.ts";
import { type Ipa, readIpa, writeIpa } from "@signer/infrastructure/ipa/index.ts";

export type SignerProgress =
  | { readonly stage: "reading" }
  | { readonly stage: "reconciling" }
  | ({ readonly stage: "signing" } & SignBundleProgress)
  | { readonly stage: "writing" };

export interface SignIpaOptions {
  readonly signing: SigningMode;
  /**
   * Prepare for sideloading (new bundle IDs, profiles, profile entitlements). Without it the app is
   * re-signed in place, keeping each executable's existing entitlements.
   */
  readonly sideload?: Omit<ReconcileOptions, "now">;
  readonly onProgress?: (progress: SignerProgress) => void;
  readonly signal?: AbortSignal;
  /** Page size, hash algorithms and CMS reservation (defaults follow Apple codesign 26). */
  readonly policy?: Partial<SigningPolicy>;
  /** Hostile-input limits for plists, Mach-O and the archive (defaults: DEFAULT_SIGNER_LIMITS). */
  readonly limits?: Overrides<SignerLimits>;
  /** Archive handling (defaults: store-only output, DEFAULT_DROPPED_MEMBERS, DEFAULT_STORED_EXTENSIONS). */
  readonly archive?: ArchiveOptions;
}

export interface ArchiveOptions {
  /** Deflate level for the output, 0–9 (default 0 = store; fastest, fine for device installs). */
  readonly compressionLevel?: number;
  readonly storedExtensions?: RegExp;
  readonly droppedMembers?: readonly RegExp[];
  readonly entryDate?: Date;
}

export interface SignIpaDeps {
  readonly logger?: Logger;
  readonly clock?: Clock;
  readonly hasher?: Hasher;
}

export interface SignIpaSummary {
  readonly appName: string;
  readonly bundles: readonly { readonly path: string; readonly identifier: string; readonly cdhash: Uint8Array }[];
  readonly looseBinaries: number;
  readonly reconciled: ReconcileResult | undefined;
  readonly ms: number;
}

export interface SignedIpa {
  /** The signed .ipa; consume it once (e.g. pipe to a file or upload). */
  readonly ipa: ReadableStream<Uint8Array>;
  /** The signed app tree, for callers that install unpacked (no re-zip needed). */
  readonly app: Ipa;
  readonly summary: SignIpaSummary;
}

/** Store-only output unless the caller asks for compression. */
const DEFAULT_COMPRESSION_LEVEL = 0;

/** Without sideload changes, keep what each executable was signed with before. */
const preservedEntitlements = (app: BundleTree, limits: SignerLimits): Map<string, EntitlementsInput> => {
  const preserved = new Map<string, EntitlementsInput>();
  for (const bundle of discoverBundles(app, limits)) {
    const entitlements = embeddedEntitlements(readFile(app, bundle.executable), limits);
    if (entitlements) preserved.set(bundle.path, entitlements);
  }
  return preserved;
};

/** Per-bundle config: the reconciled profile and entitlements, or the preserved entitlements. */
const bundleConfigs =
  (signing: SigningMode, reconciled: ReconcileResult | undefined, preserved: ReadonlyMap<string, EntitlementsInput>) =>
  (bundle: CodeBundle): BundleSigningConfig => {
    const provisioning = reconciled?.provisioning.get(bundle.path);
    return compact({
      signing,
      entitlements: provisioning?.entitlements ?? preserved.get(bundle.path),
      provisioningProfile: provisioning?.provisioningProfile,
    });
  };

/** Signs an .ipa end to end: read → (reconcile) → sign every bundle bottom-up → write. */
export const signIpa = async (
  source: FileSource,
  options: SignIpaOptions,
  deps: SignIpaDeps = {},
): Promise<SignedIpa> => {
  const { logger, clock } = resolveDeps(deps);
  const signingDeps: SigningDeps = { hasher: deps.hasher ?? createHasher(), logger, clock };
  const started = Date.now();
  logger.info("signing ipa", {
    source: source.name,
    bytes: source.size,
    mode: options.signing.kind,
    sideload: !!options.sideload,
  });

  try {
    const limits = resolveLimits(options.limits);
    const archive = options.archive ?? {};
    options.onProgress?.({ stage: "reading" });
    const ipa = await readIpa(
      source,
      compact({ logger, limits: limits.ipa, droppedMembers: archive.droppedMembers, signal: options.signal }),
    );

    let reconciled: ReconcileResult | undefined;
    if (options.sideload) {
      options.onProgress?.({ stage: "reconciling" });
      reconciled = reconcileForSideload(ipa.app, { limits, ...options.sideload, now: clock.now() }, logger);
    }
    const preserved = reconciled ? new Map<string, EntitlementsInput>() : preservedEntitlements(ipa.app, limits);

    const signed = await signBundle(
      ipa.app,
      compact({
        configFor: bundleConfigs(options.signing, reconciled, preserved),
        onProgress: (event: SignBundleProgress) => options.onProgress?.({ stage: "signing", ...event }),
        limits,
        policy: options.policy,
        signal: options.signal,
      }),
      signingDeps,
    );

    options.signal?.throwIfAborted();
    options.onProgress?.({ stage: "writing" });
    const stream = writeIpa(
      ipa,
      compact({
        logger,
        level: archive.compressionLevel ?? DEFAULT_COMPRESSION_LEVEL,
        storedExtensions: archive.storedExtensions,
        entryDate: archive.entryDate,
      }),
    );
    const summary: SignIpaSummary = {
      appName: ipa.appName,
      bundles: signed.bundles,
      looseBinaries: signed.looseBinaries,
      reconciled,
      ms: Date.now() - started,
    };
    logger.info("signed ipa", { appName: ipa.appName, bundles: signed.bundles.length, ms: summary.ms });
    return { ipa: stream, app: ipa, summary };
  } catch (error) {
    const failure = toLoadstarError(error);
    logger.error("signing failed", { code: failure.code, error: failure });
    throw failure;
  }
};

import { type Clock, type FileSource, type Logger, silentLogger, systemClock, toLoadstarError } from "@loadstar/kernel";
import { embeddedEntitlements } from "@signer/application/embedded-entitlements.ts";
import { type ReconcileOptions, type ReconcileResult, reconcileForSideload } from "@signer/application/reconcile.ts";
import type { EntitlementsInput, SigningMode } from "@signer/application/sign-binary.ts";
import { type SignBundleProgress, signBundle } from "@signer/application/sign-bundle.ts";
import { type CodeBundle, discoverBundles } from "@signer/domain/bundle/discover.ts";
import { readFile } from "@signer/domain/bundle/tree.ts";
import { type Overrides, resolveLimits, type SignerLimits, type SigningPolicy } from "@signer/domain/config.ts";
import type { Hasher } from "@signer/domain/ports/hasher.ts";
import { createHasher } from "@signer/infrastructure/hashing/index.ts";
import { type Ipa, readIpa, writeIpa } from "@signer/infrastructure/ipa/ipa.ts";

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

/** Signs an .ipa end to end: read → (reconcile) → sign every bundle bottom-up → write. */
export const signIpa = async (
  source: FileSource,
  options: SignIpaOptions,
  deps: SignIpaDeps = {},
): Promise<SignedIpa> => {
  const logger = (deps.logger ?? silentLogger).child({ scope: "signer" });
  const clock = deps.clock ?? systemClock;
  const hasher = deps.hasher ?? createHasher();
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
    const ipa = await readIpa(source, {
      logger,
      limits: limits.ipa,
      ...(archive.droppedMembers ? { droppedMembers: archive.droppedMembers } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });

    let reconciled: ReconcileResult | undefined;
    if (options.sideload) {
      options.onProgress?.({ stage: "reconciling" });
      reconciled = reconcileForSideload(ipa.app, { limits, ...options.sideload, now: clock.now() }, logger);
    }

    // Without sideload changes, keep what each executable was signed with before.
    const preserved = new Map<string, EntitlementsInput>();
    if (!reconciled) {
      for (const bundle of discoverBundles(ipa.app, limits)) {
        const entitlements = embeddedEntitlements(readFile(ipa.app, bundle.executable), limits);
        if (entitlements) preserved.set(bundle.path, entitlements);
      }
    }

    const configFor = (bundle: CodeBundle) => {
      const provisioning = reconciled?.provisioning.get(bundle.path);
      const entitlements = provisioning?.entitlements ?? preserved.get(bundle.path);
      return {
        signing: options.signing,
        ...(entitlements ? { entitlements } : {}),
        ...(provisioning ? { provisioningProfile: provisioning.provisioningProfile } : {}),
      };
    };

    const signed = await signBundle(
      ipa.app,
      {
        configFor,
        onProgress: (event) => options.onProgress?.({ stage: "signing", ...event }),
        limits,
        ...(options.policy ? { policy: options.policy } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      },
      { hasher, logger, clock },
    );

    options.signal?.throwIfAborted();
    options.onProgress?.({ stage: "writing" });
    const stream = writeIpa(ipa, {
      logger,
      level: archive.compressionLevel ?? 0,
      ...(archive.storedExtensions ? { storedExtensions: archive.storedExtensions } : {}),
      ...(archive.entryDate ? { entryDate: archive.entryDate } : {}),
    });
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

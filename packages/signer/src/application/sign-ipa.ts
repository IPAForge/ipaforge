import { type Clock, type FileSource, type Logger, silentLogger, systemClock, toLoadstarError } from "@loadstar/kernel";
import { embeddedEntitlements } from "@signer/application/embedded-entitlements.ts";
import { type ReconcileOptions, type ReconcileResult, reconcileForSideload } from "@signer/application/reconcile.ts";
import type { EntitlementsInput, SigningMode } from "@signer/application/sign-binary.ts";
import { type SignBundleProgress, signBundle } from "@signer/application/sign-bundle.ts";
import { type CodeBundle, discoverBundles } from "@signer/domain/bundle/discover.ts";
import { readFile } from "@signer/domain/bundle/tree.ts";
import type { Hasher } from "@signer/domain/ports/hasher.ts";
import { createHasher } from "@signer/infrastructure/hashing/index.ts";
import { type Ipa, type IpaLimits, readIpa, writeIpa } from "@signer/infrastructure/ipa/ipa.ts";

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
  readonly limits?: IpaLimits;
  /** Deflate level for the output (0 = store; fastest, fine for device installs). */
  readonly compressionLevel?: number;
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
    options.onProgress?.({ stage: "reading" });
    const ipa = await readIpa(source, {
      logger,
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.limits ? { limits: options.limits } : {}),
    });

    let reconciled: ReconcileResult | undefined;
    if (options.sideload) {
      options.onProgress?.({ stage: "reconciling" });
      reconciled = reconcileForSideload(ipa.app, { ...options.sideload, now: clock.now() }, logger);
    }

    // Without sideload changes, keep what each executable was signed with before.
    const preserved = new Map<string, EntitlementsInput>();
    if (!reconciled) {
      for (const bundle of discoverBundles(ipa.app)) {
        const entitlements = embeddedEntitlements(readFile(ipa.app, bundle.executable));
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
        ...(options.signal ? { signal: options.signal } : {}),
      },
      { hasher, logger, clock },
    );

    options.signal?.throwIfAborted();
    options.onProgress?.({ stage: "writing" });
    const stream = writeIpa(ipa, { logger, level: options.compressionLevel ?? 0 });
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

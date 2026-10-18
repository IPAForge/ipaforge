import { compact, type FileSource, toIPAForgeError } from '@ipaforge/kernel'
import { applyBundleAdditions } from '@signer/application/bundle-additions.ts'
import { embeddedEntitlements } from '@signer/application/embedded-entitlements.ts'
import { reconcileForSideload } from '@signer/application/reconcile.ts'
import { signBundle } from '@signer/application/sign-bundle.ts'
import type {
  BundleSigningConfig,
  EntitlementsInput,
  ReconcileResult,
  SignBundleProgress,
  SignedIpa,
  SignIpaDeps,
  SignIpaOptions,
  SignIpaSummary,
  SigningMode
} from '@signer/application/types.ts'
import { resolveDeps } from '@signer/deps.ts'
import { discoverBundles } from '@signer/domain/bundle/discover.ts'
import { readFile } from '@signer/domain/bundle/tree.ts'
import type { BundleTree, CodeBundle } from '@signer/domain/bundle/types.ts'
import { resolveLimits } from '@signer/domain/config.ts'
import type { SignerLimits } from '@signer/domain/types.ts'
import { createHasher } from '@signer/infrastructure/hashing/index.ts'
import { readIpa, writeIpa } from '@signer/infrastructure/ipa/index.ts'
import type { SigningDeps } from '@signer/types.ts'

/** Store-only output unless the caller asks for compression. */
const DEFAULT_COMPRESSION_LEVEL = 0

/** Without sideload changes, keep what each executable was signed with before. */
const preservedEntitlements = (
  app: BundleTree,
  limits: SignerLimits
): Map<string, EntitlementsInput> => {
  const preserved = new Map<string, EntitlementsInput>()
  for (const bundle of discoverBundles(app, limits)) {
    const entitlements = embeddedEntitlements(
      readFile(app, bundle.executable),
      limits
    )
    if (entitlements) preserved.set(bundle.path, entitlements)
  }
  return preserved
}

/** Per-bundle config: the reconciled profile and entitlements, or the preserved entitlements. */
const bundleConfigs =
  (
    signing: SigningMode,
    reconciled: ReconcileResult | undefined,
    preserved: ReadonlyMap<string, EntitlementsInput>
  ) =>
  (bundle: CodeBundle): BundleSigningConfig => {
    const provisioning = reconciled?.provisioning.get(bundle.path)

    return compact({
      signing,
      entitlements: provisioning?.entitlements ?? preserved.get(bundle.path),
      provisioningProfile: provisioning?.provisioningProfile
    })
  }

/** Signs an .ipa end to end: read → (reconcile) → sign every bundle bottom-up → write. */
export const signIpa = async (
  source: FileSource,
  options: SignIpaOptions,
  deps: SignIpaDeps = {}
): Promise<SignedIpa> => {
  const { logger, clock } = resolveDeps(deps)
  const signingDeps: SigningDeps = {
    hasher: deps.hasher ?? createHasher(),
    logger,
    clock
  }
  const started = Date.now()
  logger.info('signing ipa', {
    source: source.name,
    bytes: source.size,
    mode: options.signing.kind,
    sideload: !!options.sideload
  })

  try {
    const limits = resolveLimits(options.limits)
    const archive = options.archive ?? {}
    options.onProgress?.({ stage: 'reading' })
    const ipa = await readIpa(
      source,
      compact({
        logger,
        limits: limits.ipa,
        droppedMembers: archive.droppedMembers,
        signal: options.signal
      })
    )

    let reconciled: ReconcileResult | undefined
    if (options.sideload) {
      options.onProgress?.({ stage: 'reconciling' })
      reconciled = reconcileForSideload(
        ipa.app,
        { limits, ...options.sideload, now: clock.now() },
        logger
      )
    }
    applyBundleAdditions(
      ipa.app,
      options.additions,
      compact({ limits, logger, renamed: reconciled?.bundleIds })
    )
    const preserved = reconciled
      ? new Map<string, EntitlementsInput>()
      : preservedEntitlements(ipa.app, limits)

    const signed = await signBundle(
      ipa.app,
      compact({
        configFor: bundleConfigs(options.signing, reconciled, preserved),
        onProgress: (event: SignBundleProgress) =>
          options.onProgress?.({ stage: 'signing', ...event }),
        limits,
        policy: options.policy,
        signal: options.signal
      }),
      signingDeps
    )

    options.signal?.throwIfAborted()
    options.onProgress?.({ stage: 'writing' })
    const stream = writeIpa(
      ipa,
      compact({
        logger,
        level: archive.compressionLevel ?? DEFAULT_COMPRESSION_LEVEL,
        storedExtensions: archive.storedExtensions,
        entryDate: archive.entryDate
      })
    )
    const summary: SignIpaSummary = {
      appName: ipa.appName,
      bundles: signed.bundles,
      looseBinaries: signed.looseBinaries,
      reconciled,
      ms: Date.now() - started
    }
    logger.info('signed ipa', {
      appName: ipa.appName,
      bundles: signed.bundles.length,
      ms: summary.ms
    })
    return { ipa: stream, app: ipa, summary }
  } catch (error) {
    const failure = toIPAForgeError(error)
    logger.error('signing failed', { code: failure.code, error: failure })
    throw failure
  }
}

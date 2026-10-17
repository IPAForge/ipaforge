// Read-only look at an .ipa: what must be provisioned, and every failure knowable before any Apple call.
import {
  compact,
  ErrorCode,
  type FileSource,
  LoadstarError,
  toLoadstarError
} from '@loadstar/kernel'
import { embeddedEntitlements } from '@signer/application/embedded-entitlements.ts'
import { resolveDeps } from '@signer/deps.ts'
import { discoverBundles } from '@signer/domain/bundle/discover.ts'
import { assertNestedId } from '@signer/domain/bundle/info-plist.ts'
import { IPA_PAYLOAD_DIR } from '@signer/domain/bundle/layout.ts'
import { joinPath, readFile } from '@signer/domain/bundle/tree.ts'
import type { BundleTree, CodeBundle } from '@signer/domain/bundle/types.ts'
import { resolveLimits } from '@signer/domain/config.ts'
import { architecturesOf } from '@signer/domain/macho/architecture.ts'
import { isEncryptedSlice } from '@signer/domain/macho/encryption.ts'
import { isMachO, parseMachO } from '@signer/domain/macho/parse.ts'
import {
  declaredGroups,
  inspectedApp,
  inspectedBundle,
  isNestedProvisioned
} from '@signer/domain/sideload/inspection.ts'
import type { IpaInspection } from '@signer/domain/sideload/types.ts'
import type { Overrides, SignerLimits } from '@signer/domain/types.ts'
import { readIpa } from '@signer/infrastructure/ipa/index.ts'
import type { SignerDeps } from '@signer/types.ts'

export type InspectIpaOptions = {
  readonly signal?: AbortSignal
  /** Hostile-input limits for plists, Mach-O and the archive (defaults: DEFAULT_SIGNER_LIMITS). */
  readonly limits?: Overrides<SignerLimits>
}

const byPath = (a: CodeBundle, b: CodeBundle): number =>
  a.path.localeCompare(b.path)

/** Malformed Mach-O is left to signing, which rejects or skips it. */
const isEncryptedMachO = (data: Uint8Array, limits: SignerLimits): boolean => {
  try {
    return parseMachO(data, limits.machO).slices.some(isEncryptedSlice)
  } catch {
    return false
  }
}

/** FairPlay-encrypted code cannot be re-signed; refuse the whole app up front. */
const assertDecrypted = (
  tree: BundleTree,
  limits: SignerLimits,
  signal: AbortSignal | undefined
): void => {
  for (const [path, entry] of tree) {
    signal?.throwIfAborted()
    if (entry.kind !== 'file' || !isMachO(entry.data)) continue
    if (!isEncryptedMachO(entry.data, limits)) continue
    throw new LoadstarError(ErrorCode.EncryptedBinary, {
      message:
        'binary is FairPlay-encrypted (App Store build); a decrypted IPA is required',
      data: { path }
    })
  }
}

/**
 * Reads an .ipa without changing it and reports the app, its provisioned extensions and watch apps, and
 * the groups it declares, and what the app needs from a device (minimum iOS, device families, architectures; see
 * `checkCompatibility`). Fails early with `InvalidBundle`, `EncryptedBinary` or `ExtensionPrefix`.
 */
export const inspectIpa = async (
  source: FileSource,
  options: InspectIpaOptions = {},
  deps: Partial<SignerDeps> = {}
): Promise<IpaInspection> => {
  const { logger } = resolveDeps(deps)
  try {
    const limits = resolveLimits(options.limits)
    const ipa = await readIpa(
      source,
      compact({ logger, limits: limits.ipa, signal: options.signal })
    )
    const bundles = discoverBundles(ipa.app, limits)
    const main = bundles.at(-1) as CodeBundle
    const nested = bundles.filter(isNestedProvisioned).sort(byPath)
    for (const bundle of nested)
      assertNestedId(bundle.identifier, main.identifier)
    assertDecrypted(ipa.app, limits, options.signal)

    const executable = readFile(ipa.app, main.executable)
    const entitlements = embeddedEntitlements(executable, limits)?.dict
    const architectures = executable
      ? architecturesOf(executable, limits.machO)
      : []
    const inspection: IpaInspection = {
      app: inspectedApp(
        main,
        joinPath(IPA_PAYLOAD_DIR, ipa.appName),
        architectures
      ),
      nested: nested.map(inspectedBundle),
      ...declaredGroups(main, entitlements)
    }
    logger.info('inspected ipa', {
      identifier: main.identifier,
      nested: nested.length
    })
    return inspection
  } catch (error) {
    const failure = toLoadstarError(error)
    logger.error('inspection failed', { code: failure.code, error: failure })
    throw failure
  }
}

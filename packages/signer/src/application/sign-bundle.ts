import { compact, type Logger } from '@loadstar/kernel'
import { hashAlgorithmsFor } from '@signer/application/policy.ts'
import { signBinary } from '@signer/application/sign-binary.ts'
import type {
  BundleRun,
  BundleSigningConfig,
  SignBundleOptions,
  SignBundleProgress,
  SignedBundle,
  SignedBundleSummary,
  WorkItem
} from '@signer/application/types.ts'
import {
  discoverBundles,
  discoverLooseBinaries,
  resourceEntriesOf
} from '@signer/domain/bundle/discover.ts'
import {
  CODE_RESOURCES_PATH,
  CODE_SIGNATURE_DIR,
  DEFAULT_FILE_MODE,
  EMBEDDED_PROFILE,
  INFO_PLIST,
  SC_INFO_DIR
} from '@signer/domain/bundle/layout.ts'
import {
  baseName,
  joinPath,
  readFile,
  removePath,
  writeFile
} from '@signer/domain/bundle/tree.ts'
import type {
  BundleTree,
  CodeBundle,
  LooseBinary
} from '@signer/domain/bundle/types.ts'
import {
  buildCodeResources,
  type CodeResourcesResult
} from '@signer/domain/code-resources/index.ts'
import { resolveLimits, resolvePolicy } from '@signer/domain/config.ts'
import { parseMachO } from '@signer/domain/macho/parse.ts'
import type { SigningDeps } from '@signer/types.ts'

/**
 * codesign's canonical identifier for a file: drop the directory and the last extension unless
 * it starts with a digit (`libFoo.dylib` → `libFoo`, `libz.1.2.dylib` → `libz.1.2`).
 */
export const canonicalIdentifier = (path: string): string => {
  const name = baseName(path)
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return name
  const extension = name.slice(dot + 1)

  return /^\d/.test(extension) ? name : name.slice(0, dot)
}

/** Stale signing artefacts that must not survive re-signing. */
const cleanBundle = (tree: BundleTree, logger: Logger): void => {
  for (const path of [...tree.keys()]) {
    const parts = path.split('/')
    const index = parts.findIndex(
      (part) => part === CODE_SIGNATURE_DIR || part === SC_INFO_DIR
    )
    if (index >= 0) removePath(tree, parts.slice(0, index + 1).join('/'))
  }
  logger.debug(`removed stale ${CODE_SIGNATURE_DIR}/${SC_INFO_DIR} directories`)
}

/** Each loose binary is signed before the bundle that contains it is sealed; bundles go deepest first. */
const signingOrder = (
  bundles: readonly CodeBundle[],
  loose: readonly LooseBinary[]
): WorkItem[] =>
  bundles.flatMap((bundle): WorkItem[] => [
    ...loose
      .filter((binary) => binary.bundle === bundle.path)
      .map((binary) => ({ type: 'binary' as const, ...binary })),
    { type: 'bundle', bundle }
  ])

const progressOf = (
  item: WorkItem,
  index: number,
  total: number
): SignBundleProgress =>
  item.type === 'binary'
    ? { type: 'binary', path: item.path, index, total }
    : {
        type: 'bundle',
        path: item.bundle.path,
        identifier: item.bundle.identifier,
        index,
        total
      }

const signLooseBinary = async (
  run: BundleRun,
  binary: LooseBinary
): Promise<void> => {
  const config = run.configs.get(binary.bundle)
  const data = readFile(run.tree, binary.path)
  if (!config || !data) return
  const result = await signBinary(
    data,
    {
      identifier: run.looseIdentifier(binary.path),
      signing: config.signing,
      ...run.shared
    },
    run.deps
  )
  writeFile(run.tree, binary.path, result.bytes)
}

/** Builds and writes `_CodeSignature/CodeResources`; agile (SHA-1 + SHA-256) executables get dual hashes. */
const writeCodeResources = async (
  run: BundleRun,
  bundle: CodeBundle,
  executable: Uint8Array
): Promise<CodeResourcesResult> => {
  const slices = parseMachO(executable, run.limits.machO).slices
  const agile = hashAlgorithmsFor(slices, run.policy.hashAlgorithms).includes(
    'sha1'
  )
  const resources = await buildCodeResources(
    resourceEntriesOf(run.tree, bundle.path),
    {
      mainExecutable: baseName(bundle.executable),
      hashMode: agile ? 'dual' : 'sha256'
    },
    run.deps.hasher
  )
  writeFile(
    run.tree,
    joinPath(bundle.path, CODE_RESOURCES_PATH),
    resources.bytes,
    DEFAULT_FILE_MODE
  )
  return resources
}

/** Embeds the profile, seals the bundle's resources and signs its executable. */
const sealBundle = async (
  run: BundleRun,
  bundle: CodeBundle
): Promise<SignedBundle> => {
  const config = run.configs.get(bundle.path) as BundleSigningConfig
  if (config.provisioningProfile) {
    writeFile(
      run.tree,
      joinPath(bundle.path, EMBEDDED_PROFILE),
      config.provisioningProfile,
      DEFAULT_FILE_MODE
    )
  }

  const executable = readFile(run.tree, bundle.executable) as Uint8Array
  const resources = await writeCodeResources(run, bundle, executable)
  const result = await signBinary(
    executable,
    compact({
      identifier: bundle.identifier,
      signing: config.signing,
      entitlements:
        bundle.kind === 'framework' ? undefined : config.entitlements,
      infoPlist: readFile(run.tree, joinPath(bundle.path, INFO_PLIST)),
      codeResources: resources.bytes,
      ...run.shared
    }),
    run.deps
  )
  writeFile(run.tree, bundle.executable, result.bytes)
  run.logger.info('sealed bundle', {
    path: bundle.path || '.',
    identifier: bundle.identifier,
    sealed: resources.sealed,
    omitted: resources.omitted
  })
  return {
    path: bundle.path,
    identifier: bundle.identifier,
    cdhash: result.cdhashes[0] as Uint8Array
  }
}

/**
 * Signs every code bundle and loose binary in `tree`, innermost first, mutating the tree in
 * place. Matches Apple codesign's bundle layout for iOS (flat CodeResources, profiles sealed).
 */
export const signBundle = async (
  tree: BundleTree,
  options: SignBundleOptions,
  deps: SigningDeps
): Promise<SignedBundleSummary> => {
  const logger = deps.logger.child({ scope: 'bundle' })
  cleanBundle(tree, logger)

  const limits = resolveLimits(options.limits)
  const policy = resolvePolicy(options.policy)
  const bundles = discoverBundles(tree, limits)
  const loose = discoverLooseBinaries(tree, bundles, limits)
  const run: BundleRun = {
    tree,
    configs: new Map(
      bundles.map((bundle) => [bundle.path, options.configFor(bundle)])
    ),
    looseIdentifier: options.looseIdentifier ?? canonicalIdentifier,
    limits,
    policy,
    shared: compact({ policy, limits, signal: options.signal }),
    deps,
    logger
  }
  logger.info('discovered code', {
    bundles: bundles.map((b) => `${b.path || '.'} (${b.kind})`),
    looseBinaries: loose.map((l) => l.path)
  })

  const work = signingOrder(bundles, loose)
  const signed: SignedBundle[] = []
  for (const [index, item] of work.entries()) {
    options.signal?.throwIfAborted()
    options.onProgress?.(progressOf(item, index, work.length))
    if (item.type === 'binary') await signLooseBinary(run, item)
    else signed.push(await sealBundle(run, item.bundle))
  }

  return { bundles: signed, looseBinaries: loose.length }
}

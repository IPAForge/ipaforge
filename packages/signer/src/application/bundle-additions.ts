import {
  createDict,
  ErrorCode,
  IPAForgeError,
  isPlistDict,
  type PlistDict,
  parsePlist,
  serializeXmlPlist
} from '@ipaforge/kernel'
import { UNSAFE_SEGMENTS } from '@signer/application/constants.ts'
import type {
  BundleAddition,
  BundleAdditions,
  BundleAdditionsContext
} from '@signer/application/types.ts'
import { discoverBundles } from '@signer/domain/bundle/discover.ts'
import { INFO_PLIST } from '@signer/domain/bundle/layout.ts'
import { joinPath, readFile, writeFile } from '@signer/domain/bundle/tree.ts'
import type { BundleTree, CodeBundle } from '@signer/domain/bundle/types.ts'
import type { SignerLimits } from '@signer/domain/types.ts'

const isContainedPath = (path: string): boolean =>
  !path.includes('\\') &&
  !path.includes('\0') &&
  !path.split('/').some((segment) => UNSAFE_SEGMENTS.has(segment))

const invalidAddition = (
  message: string,
  data: Record<string, unknown>
): IPAForgeError =>
  new IPAForgeError(ErrorCode.InvalidBundle, { message, data })

const withOriginalIdentifiers = (
  bundles: readonly CodeBundle[],
  renamed: ReadonlyMap<string, string> | undefined
): CodeBundle[] => {
  const original = new Map([...(renamed ?? [])].map(([from, to]) => [to, from]))

  return bundles.map((bundle) => ({
    ...bundle,
    identifier: original.get(bundle.identifier) ?? bundle.identifier
  }))
}

const targetBundle = (
  bundles: readonly CodeBundle[],
  bundlePath: string
): CodeBundle => {
  const bundle = bundles.find((candidate) => candidate.path === bundlePath)
  if (!bundle)
    throw invalidAddition('addition targets a path that is not a code bundle', {
      bundlePath
    })
  return bundle
}

const writeFiles = (
  tree: BundleTree,
  bundle: CodeBundle,
  files: ReadonlyMap<string, Uint8Array>
): void => {
  for (const [path, data] of files) {
    if (!isContainedPath(path))
      throw invalidAddition('added file escapes its bundle', {
        bundle: bundle.path,
        path
      })
    writeFile(tree, joinPath(bundle.path, path), data)
  }
}

/** The Info.plist as it is now in the tree (an earlier addition may have changed it). */
const currentInfoPlist = (
  tree: BundleTree,
  bundle: CodeBundle,
  limits: SignerLimits
): PlistDict => {
  const bytes = readFile(tree, joinPath(bundle.path, INFO_PLIST))
  const value = bytes && parsePlist(bytes, limits.plist)

  return value && isPlistDict(value) ? value : bundle.infoPlist
}

const setInfoPlistKeys = (
  tree: BundleTree,
  bundle: CodeBundle,
  keys: PlistDict,
  limits: SignerLimits
): void => {
  const merged = createDict([
    ...Object.entries(currentInfoPlist(tree, bundle, limits)),
    ...Object.entries(keys)
  ])
  writeFile(tree, joinPath(bundle.path, INFO_PLIST), serializeXmlPlist(merged))
}

const applyAddition = (
  tree: BundleTree,
  bundles: readonly CodeBundle[],
  addition: BundleAddition,
  context: BundleAdditionsContext
): void => {
  const bundle = targetBundle(bundles, addition.bundlePath)
  if (addition.files) writeFiles(tree, bundle, addition.files)
  if (addition.infoPlist)
    setInfoPlistKeys(tree, bundle, addition.infoPlist, context.limits)
  context.logger.info('added content to bundle', {
    bundle: bundle.path,
    files: [...(addition.files?.keys() ?? [])],
    infoPlistKeys: Object.keys(addition.infoPlist ?? {})
  })
}

/** Asks `plan` what to add and writes it into the tree. Runs after reconciliation and before signing. */
export const applyBundleAdditions = (
  tree: BundleTree,
  plan: BundleAdditions | undefined,
  context: BundleAdditionsContext
): void => {
  if (!plan) return
  const bundles = discoverBundles(tree, context.limits)
  for (const addition of plan(
    withOriginalIdentifiers(bundles, context.renamed)
  )) {
    applyAddition(tree, bundles, addition, context)
  }
}

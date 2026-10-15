import {
  ErrorCode,
  isPlistDict,
  LoadstarError,
  type PlistDict,
  parsePlist,
  stringAt
} from '@loadstar/kernel'
import {
  CF_BUNDLE_EXECUTABLE,
  CF_BUNDLE_IDENTIFIER
} from '@signer/domain/bundle/info-keys.ts'
import { CODE_SIGNATURE_DIR, INFO_PLIST } from '@signer/domain/bundle/layout.ts'
import {
  type BundleTree,
  isWithin,
  joinPath,
  readFile,
  relativeTo
} from '@signer/domain/bundle/tree.ts'
import type { ResourceEntry } from '@signer/domain/code-resources/index.ts'
import {
  DEFAULT_SIGNER_LIMITS,
  type PlistLimits,
  type SignerLimits
} from '@signer/domain/config.ts'
import {
  MH_BUNDLE,
  MH_DYLIB,
  MH_EXECUTE
} from '@signer/domain/macho/constants.ts'
import { isMachO, parseMachO } from '@signer/domain/macho/parse.ts'

export type BundleKind = 'app' | 'appex' | 'framework' | 'watch-app' | 'xctest'

export type CodeBundle = {
  /** Path of the bundle directory relative to the main app ("" for the main app). */
  readonly path: string
  readonly kind: BundleKind
  readonly infoPlist: PlistDict
  readonly identifier: string
  /** Path of the executable relative to the main app. */
  readonly executable: string
  /** Nesting depth (0 = main app). */
  readonly depth: number
}

export type LooseBinary = {
  /** Path relative to the main app. */
  readonly path: string
  /** The innermost bundle containing it. */
  readonly bundle: string
}

const BUNDLE_SUFFIXES: readonly [string, BundleKind][] = [
  ['.appex', 'appex'],
  ['.framework', 'framework'],
  ['.app', 'watch-app'],
  ['.xctest', 'xctest']
]

/** Bundles that need their own App ID and provisioning profile. */
const PROVISIONED_KINDS = new Set<BundleKind>(['app', 'appex', 'watch-app'])

export const isProvisioned = (bundle: CodeBundle): boolean =>
  PROVISIONED_KINDS.has(bundle.kind)

const SIGNABLE_FILETYPES = new Set([MH_EXECUTE, MH_DYLIB, MH_BUNDLE])

/** Number of path components ("" — the main app — is depth 0). */
const pathDepth = (path: string): number =>
  path === '' ? 0 : path.split('/').length

/** Signing order: deepest first, then by path for a stable result. */
const deepestFirst = (
  a: { readonly path: string },
  b: { readonly path: string }
): number =>
  pathDepth(b.path) - pathDepth(a.path) || a.path.localeCompare(b.path)

const bundleKindOf = (dir: string): BundleKind | undefined =>
  BUNDLE_SUFFIXES.find(([suffix]) => dir.endsWith(suffix))?.[1]

/** Every directory in the tree whose name marks it as a nested bundle. */
const bundleDirectories = (tree: BundleTree): Set<string> => {
  const directories = new Set<string>()
  for (const path of tree.keys()) {
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/')
      if (bundleKindOf(dir)) directories.add(dir)
    }
  }
  return directories
}

const readInfoPlist = (
  tree: BundleTree,
  bundlePath: string,
  limits: PlistLimits
): PlistDict | undefined => {
  const bytes = readFile(tree, joinPath(bundlePath, INFO_PLIST))
  if (!bytes) return undefined
  const value = parsePlist(bytes, limits)

  return isPlistDict(value) ? value : undefined
}

const describeBundle = (
  tree: BundleTree,
  path: string,
  kind: BundleKind,
  limits: PlistLimits
): CodeBundle | undefined => {
  const infoPlist = readInfoPlist(tree, path, limits)
  const executableName = infoPlist && stringAt(infoPlist, CF_BUNDLE_EXECUTABLE)
  const identifier = infoPlist && stringAt(infoPlist, CF_BUNDLE_IDENTIFIER)
  if (!infoPlist || !executableName || !identifier) return undefined // resource-only bundle
  const executable = joinPath(path, executableName)
  if (!readFile(tree, executable)) return undefined
  return {
    path,
    kind,
    infoPlist,
    identifier,
    executable,
    depth: pathDepth(path)
  }
}

/** Code bundles in the tree, deepest first (the order they must be signed in), main app last. */
export const discoverBundles = (
  tree: BundleTree,
  limits: SignerLimits = DEFAULT_SIGNER_LIMITS
): CodeBundle[] => {
  const main = describeBundle(tree, '', 'app', limits.plist)
  if (!main) {
    throw new LoadstarError(ErrorCode.InvalidBundle, {
      message:
        'app bundle has no Info.plist with CFBundleExecutable/CFBundleIdentifier, or its executable is missing'
    })
  }

  const nested = [...bundleDirectories(tree)]
    .map((dir) =>
      describeBundle(tree, dir, bundleKindOf(dir) ?? 'framework', limits.plist)
    )
    .filter((bundle): bundle is CodeBundle => bundle !== undefined)

  return [...nested.sort(deepestFirst), main]
}

/** Innermost code bundle that contains `path`. */
export const owningBundle = (
  bundles: readonly CodeBundle[],
  path: string
): CodeBundle | undefined =>
  bundles
    .filter((bundle) => isWithin(path, bundle.path) && path !== bundle.path)
    .reduce<CodeBundle | undefined>(
      (best, bundle) => (!best || bundle.depth > best.depth ? bundle : best),
      undefined
    )

/** Every slice is an executable, dylib or bundle; malformed Mach-O stays a plain resource. */
const isSignableMachO = (data: Uint8Array, limits: SignerLimits): boolean => {
  try {
    return parseMachO(data, limits.machO).slices.every((slice) =>
      SIGNABLE_FILETYPES.has(slice.filetype)
    )
  } catch {
    return false // not a well-formed Mach-O: leave it as a plain resource
  }
}

/**
 * Mach-O executables/dylibs/bundles that are not a bundle's main executable (e.g. Frameworks/*.dylib,
 * helper tools). Detected by magic and filetype, never by extension.
 */
export const discoverLooseBinaries = (
  tree: BundleTree,
  bundles: readonly CodeBundle[],
  limits: SignerLimits = DEFAULT_SIGNER_LIMITS
): LooseBinary[] => {
  const executables = new Set(bundles.map((bundle) => bundle.executable))
  const loose: LooseBinary[] = []
  for (const [path, entry] of tree) {
    if (entry.kind !== 'file' || executables.has(path) || !isMachO(entry.data))
      continue
    if (path.split('/').includes(CODE_SIGNATURE_DIR)) continue
    if (!isSignableMachO(entry.data, limits)) continue
    loose.push({ path, bundle: owningBundle(bundles, path)?.path ?? '' })
  }
  // deepest first, so a dylib inside a framework is signed before the framework is sealed
  return loose.sort(deepestFirst)
}

/** Everything inside a bundle as CodeResources inputs (iOS seals nested bundles' files as plain resources). */
export const resourceEntriesOf = (
  tree: BundleTree,
  bundlePath: string
): ResourceEntry[] => {
  const entries: ResourceEntry[] = []
  for (const [path, entry] of tree) {
    if (!isWithin(path, bundlePath) || path === bundlePath) continue
    const relative = relativeTo(path, bundlePath)
    entries.push(
      entry.kind === 'file'
        ? { path: relative, kind: 'file', data: entry.data }
        : { path: relative, kind: 'symlink', target: entry.target }
    )
  }
  return entries
}

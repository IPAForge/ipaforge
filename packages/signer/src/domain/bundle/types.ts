import type { PlistDict, PlistValue } from '@loadstar/kernel'

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

export type IdentityRewrite = {
  readonly oldMainId: string
  readonly newMainId: string
  /** Old app group → new app group (e.g. `group.com.x` → `group.com.x.TEAMID`). */
  readonly appGroups: ReadonlyMap<string, string>
}

export type ValueUpdate = (
  value: PlistValue | undefined
) => PlistValue | undefined

/**
 * In-memory view of an app bundle: files and symlinks keyed by '/'-separated paths relative to
 * the `.app` root. Directories are implicit. Unix modes are kept (executable bits matter on iOS).
 */
export type TreeEntry =
  | { readonly kind: 'file'; readonly data: Uint8Array; readonly mode: number }
  | { readonly kind: 'symlink'; readonly target: string; readonly mode: number }

export type BundleTree = Map<string, TreeEntry>

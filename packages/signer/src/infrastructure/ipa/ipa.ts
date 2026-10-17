// The unpacked .ipa and the archive defaults shared by reading and writing.
import type { BundleTree } from '@signer/domain/bundle/types.ts'

export type Ipa = {
  /** e.g. `SideStore.app` */
  readonly appName: string
  /** The `.app` contents, paths relative to the `.app` directory. */
  readonly app: BundleTree
  /** Other top-level content kept for re-packing (e.g. `SwiftSupport/`), paths relative to the archive root. */
  readonly extras: BundleTree
}

/** Archive members dropped by default when reading: Apple-account metadata and macOS resource forks. */
export const DEFAULT_DROPPED_MEMBERS: readonly RegExp[] = [
  /^__MACOSX\//,
  /^iTunesMetadata\.plist$/,
  /^META-INF\/com\.apple\.ZipMetadata\.plist$/
]

/** Already-compressed formats stored without deflating again by default when writing. */
export const DEFAULT_STORED_EXTENSIONS: RegExp =
  /\.(?:png|jpe?g|gif|heic|car|mp3|m4a|mp4|mov|zip|ipa|gz|lzfse)$/i

/** Timestamp written on every archive entry so output is deterministic (overridable). */
export const DEFAULT_ENTRY_DATE = new Date('2026-01-01T00:00:00Z')

/** Deflate level used by writeIpa when the caller does not choose one. */
export const DEFAULT_DEFLATE_LEVEL = 6

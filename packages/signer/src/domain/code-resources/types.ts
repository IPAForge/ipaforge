/** A file or symlink in a bundle, path relative to the bundle root with '/' separators. */
export type ResourceEntry =
  | { readonly path: string; readonly kind: 'file'; readonly data: Uint8Array }
  | { readonly path: string; readonly kind: 'symlink'; readonly target: string }

export type CodeResourcesOptions = {
  /** `CFBundleExecutable`: excluded from sealing (its hash is in the CodeDirectory). */
  readonly mainExecutable: string
  /** "dual" adds SHA-1 `hash` to files2 entries (only when the CD is SHA-1 + SHA-256). */
  readonly hashMode: 'sha256' | 'dual'
}

export type CodeResourcesResult = {
  readonly bytes: Uint8Array
  readonly sealed: number
  readonly omitted: number
  readonly optional: number
}

export type ResourceRule = {
  readonly pattern: string
  readonly weight: number
  readonly omit: boolean
  readonly optional: boolean
}

export type CompiledRule = ResourceRule & {
  readonly regex: RegExp
}

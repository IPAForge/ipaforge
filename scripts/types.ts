export type Rule =
  | 'node-builtin'
  | 'platform-module'
  | 'deep-import'
  | 'forbidden-edge'
  | 'unknown-package'
  | 'escape'
  | 'relative-import'
  | 'foreign-subpath'

export type Violation = {
  readonly file: string
  readonly line: number
  readonly specifier: string
  readonly rule: Rule
  readonly detail: string
}

export type CheckResult = {
  readonly filesChecked: number
  readonly violations: readonly Violation[]
}

/** A source file being checked, with what its rules depend on. */
export type PackageFile = {
  readonly pkg: string
  readonly packages: readonly string[]
  readonly pkgRoot: string
  readonly file: string
  /** Shipped (non-test `src`) code must also be platform-free and respect the package graph. */
  readonly shipped: boolean
  /** The path in reports: relative to the root, with '/' on every OS. */
  readonly display: string
}

export type Problem =
  | 'status'
  | 'missing-file'
  | 'unlisted-file'
  | 'invalid-json'
  | 'missing-key'
  | 'extra-key'
  | 'not-a-string'
  | 'invalid-icu'
  | 'placeholder-mismatch'

export type Issue = {
  readonly language: string
  readonly key?: string
  readonly problem: Problem
  readonly detail: string
}

export type Completion = {
  readonly language: string
  readonly status: string
  readonly translated: number
  readonly total: number
}

export type LocaleReport = {
  readonly issues: readonly Issue[]
  readonly completion: readonly Completion[]
}

export type Messages = ReadonlyMap<string, unknown>

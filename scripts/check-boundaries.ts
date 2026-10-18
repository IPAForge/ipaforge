/**
 * Enforces the architecture's dependency rules for packages/*:
 *  - no Node built-ins and no platform modules (electron),
 *  - no deep imports into another workspace package,
 *  - only the package-to-package edges listed in boundaries.config.ts,
 *  - no relative imports that escape the package directory.
 *
 * Usage: pnpm check:boundaries [--verbose] [--root <dir>]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  allowedEdges,
  forbiddenModules,
  workspaceScope
} from './boundaries.config.ts'
import type { CheckResult, PackageFile, Violation } from './types.ts'

const builtins = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`])
)
const SOURCE_FILE = /\.(?:ts|tsx|mts|cts)$/
// Tests and their helpers (__tests__/) run in Node and never ship, so they may use node:* (e.g. to read fixtures).
const TEST_FILE = /\.test\.tsx?$|[\\/]__tests__[\\/]/
/** Package directories scanned; only `src` (non-test) code must be platform-free, all must use absolute imports. */
const SCANNED_DIRS = ['src', 'test', 'scripts'] as const

/** A package's source files, and whether each one ships. */
const sourceFilesOf = (
  pkgRoot: string
): { readonly file: string; readonly shipped: boolean }[] =>
  SCANNED_DIRS.flatMap((dir) =>
    listFiles(join(pkgRoot, dir))
      .filter((file) => SOURCE_FILE.test(file))
      .map((file) => ({
        file,
        shipped: dir === 'src' && !TEST_FILE.test(file)
      }))
  )

const violationsIn = (target: PackageFile): Violation[] => {
  const { pkg, packages, pkgRoot, file, shipped, display } = target

  return findImports(readFileSync(file, 'utf8')).flatMap(
    ({ specifier, line }) => {
      const violation =
        classifyImportStyle(pkg, packages, pkgRoot, file, specifier) ??
        (shipped ? classify(pkg, specifier) : undefined)

      return violation ? [{ file: display, line, specifier, ...violation }] : []
    }
  )
}

export const checkBoundaries = (
  root: string,
  onFile: (file: string) => void = () => {}
): CheckResult => {
  const packagesDir = join(root, 'packages')
  const violations: Violation[] = []
  let filesChecked = 0

  const packages = listDirs(packagesDir)
  for (const pkg of packages) {
    const pkgRoot = join(packagesDir, pkg)
    for (const { file, shipped } of sourceFilesOf(pkgRoot)) {
      filesChecked++
      const display = relative(root, file).split(sep).join('/')
      onFile(display)
      violations.push(
        ...violationsIn({ pkg, packages, pkgRoot, file, shipped, display })
      )
    }
  }
  return { filesChecked, violations }
}

/** `@kernel/…` → "kernel", `@signer-test/…` → "signer" (workspace aliases); undefined for npm scopes. */
const aliasPackage = (
  specifier: string,
  packages: readonly string[]
): string | undefined => {
  if (!specifier.startsWith('@')) return undefined
  const scope = (specifier.slice(1).split('/')[0] ?? '').replace(/-test$/, '')

  return packages.includes(scope) ? scope : undefined
}

/** Applies to every file in a package: absolute (`@<pkg>/…`) imports only, never another package's alias. */
const classifyImportStyle = (
  pkg: string,
  packages: readonly string[],
  pkgRoot: string,
  file: string,
  specifier: string
): Pick<Violation, 'rule' | 'detail'> | undefined => {
  if (specifier.startsWith('.')) {
    const target = resolve(dirname(file), specifier)
    if (target !== pkgRoot && !target.startsWith(pkgRoot + sep)) {
      return {
        rule: 'escape',
        detail:
          'relative import leaves the package; import the other package by name'
      }
    }
    return {
      rule: 'relative-import',
      detail: `use an absolute import ('@${pkg}/…', see tsconfig "paths")`
    }
  }
  const alias = aliasPackage(specifier, packages)
  if (alias && alias !== pkg) {
    return {
      rule: 'foreign-subpath',
      detail: `'${specifier}' is another package's internal alias; import @ipaforge/${alias}`
    }
  }
  return undefined
}

/** Applies to shipped source only: platform freedom and the package dependency graph. */
const classify = (
  pkg: string,
  specifier: string
): Pick<Violation, 'rule' | 'detail'> | undefined => {
  if (builtins.has(specifier) || specifier.startsWith('node:')) {
    return {
      rule: 'node-builtin',
      detail:
        'packages/* must stay platform-free; use a port and an adapter in apps/*'
    }
  }
  const bare = specifier.split('/')[0] ?? specifier
  if (forbiddenModules.includes(bare)) {
    return {
      rule: 'platform-module',
      detail: `'${bare}' is platform-specific; it belongs in apps/*`
    }
  }
  if (specifier.startsWith(`@${pkg}/`) || specifier.startsWith(`@${pkg}-test/`))
    return undefined // own alias
  if (!specifier.startsWith(workspaceScope)) return undefined // third-party dependency

  const [target, ...rest] = specifier.slice(workspaceScope.length).split('/')
  if (!target)
    return { rule: 'unknown-package', detail: 'malformed workspace import' }
  if (rest.length > 0) {
    return {
      rule: 'deep-import',
      detail: `import '${workspaceScope}${target}' (its public index) instead`
    }
  }
  const allowed = allowedEdges[pkg]
  if (!allowed)
    return {
      rule: 'unknown-package',
      detail: `package '${pkg}' is not listed in scripts/boundaries.config.ts`
    }
  if (target === pkg) return undefined
  if (!allowed.includes(target)) {
    return {
      rule: 'forbidden-edge',
      detail: `'${pkg}' may import only: ${allowed.join(', ') || '(nothing)'}`
    }
  }
  return undefined
}

/**
 * Finds module specifiers in import/export/require/dynamic-import positions.
 * Comments and string contents are blanked first (keeping offsets), so text inside them never matches.
 */
export const findImports = (
  source: string
): { specifier: string; line: number }[] => {
  const masked = maskCommentsAndStrings(source)
  const patterns = [
    /\b(?:import|export)\b[^;]*?\bfrom\s*(["'])/g, // import x from "y" / export * from "y"
    /\bimport\s*(["'])/g, // import "side-effect"
    /\bimport\s*\(\s*(["'])/g, // import("y")
    /\brequire\s*\(\s*(["'])/g // require("y")
  ]
  const found = new Map<number, { specifier: string; line: number }>()
  for (const pattern of patterns) {
    for (const match of masked.matchAll(pattern)) {
      const quoteIndex = (match.index ?? 0) + match[0].length - 1
      const quote = source[quoteIndex]
      const end = source.indexOf(quote ?? '"', quoteIndex + 1)
      if (end < 0) continue
      found.set(quoteIndex, {
        specifier: source.slice(quoteIndex + 1, end),
        line: source.slice(0, quoteIndex).split('\n').length
      })
    }
  }
  return [...found.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, value]) => value)
}

const QUOTES = new Set(['"', "'", '`'])

/** Where a `//` comment starting at `i` ends: its line break, or the end of the source. */
const lineCommentEnd = (source: string, i: number): number => {
  const end = source.indexOf('\n', i)

  return end < 0 ? source.length : end
}

/** Where a block comment starting at `i` ends: after its `*\/`, or the end of the source. */
const blockCommentEnd = (source: string, i: number): number => {
  const end = source.indexOf('*/', i + 2)

  return end < 0 ? source.length : end + 2
}

/** The index of the quote closing the string or template opened at `i`, skipping escapes. */
const closingQuote = (source: string, i: number): number => {
  const quote = source[i]
  let j = i + 1
  while (j < source.length && source[j] !== quote)
    j += source[j] === '\\' ? 2 : 1
  return j
}

/** What to blank for a comment or string starting at `i`, and where scanning resumes; undefined when none starts there. */
const maskedSpan = (
  source: string,
  i: number
):
  | { readonly from: number; readonly to: number; readonly next: number }
  | undefined => {
  const opening = source.slice(i, i + 2)
  if (opening === '//') {
    const end = lineCommentEnd(source, i)

    return { from: i, to: end, next: end }
  }
  if (opening === '/*') {
    const end = blockCommentEnd(source, i)

    return { from: i, to: end, next: end }
  }
  if (!QUOTES.has(source[i] ?? '')) return undefined
  const end = closingQuote(source, i)

  // keep the quotes so import patterns can anchor on them
  return { from: i + 1, to: end, next: end + 1 }
}

/** Replace comment text and string/template contents with spaces; keep quotes and newlines. */
const maskCommentsAndStrings = (source: string): string => {
  const out = source.split('')
  let i = 0
  while (i < source.length) {
    const span = maskedSpan(source, i)
    if (!span) {
      i++
      continue
    }
    for (let k = span.from; k < span.to; k++) if (out[k] !== '\n') out[k] = ' '
    i = span.next
  }
  return out.join('')
}

const listDirs = (dir: string): string[] => {
  try {
    return readdirSync(dir)
      .filter((name) => statSync(join(dir, name)).isDirectory())
      .sort()
  } catch {
    return []
  }
}

const listFiles = (dir: string): string[] => {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  return entries.sort().flatMap((name) => {
    const path = join(dir, name)
    if (!statSync(path).isDirectory()) return [path]
    return name === 'node_modules' ? [] : listFiles(path)
  })
}

const main = (argv: readonly string[]): number => {
  const verbose = argv.includes('--verbose')
  const rootFlag = argv.indexOf('--root')
  const root = resolve(
    (rootFlag >= 0 ? argv[rootFlag + 1] : undefined) ?? process.cwd()
  )

  const result = checkBoundaries(
    root,
    verbose ? (file) => console.debug(`[boundaries] scan ${file}`) : undefined
  )
  for (const v of result.violations) {
    console.error(
      `[boundaries] ${v.file}:${v.line}  '${v.specifier}'  ${v.rule}: ${v.detail}`
    )
  }
  console.info(
    `[boundaries] checked ${result.filesChecked} files, ${result.violations.length} violations`
  )
  return result.violations.length === 0 ? 0 : 1
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = main(process.argv.slice(2))
}

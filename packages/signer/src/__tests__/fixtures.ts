// Test-only helpers: load the golden fixtures produced by fixtures/signer/generate.sh.
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  type Stats
} from 'node:fs'
import { basename, join, relative } from 'node:path'

export const FIXTURES_DIR = join(
  import.meta.dirname,
  '../../../../fixtures/signer'
)

export type FixtureCase = {
  readonly name: string
  readonly kind: 'binary' | 'bundle'
  readonly role: 'main' | 'appex' | 'framework' | 'dylib'
  readonly identifier: string
  readonly entitlements: string | null
  readonly minOS: string
  /** Symlinks inside a bundle case (relative to the bundle); git on Windows checks them out as text files. */
  readonly symlinks?: readonly string[]
  readonly nested?: readonly {
    readonly path: string
    readonly role: 'appex' | 'framework' | 'dylib'
    readonly identifier: string
    readonly entitlements: string | null
  }[]
}

export type FixtureManifest = {
  readonly codesign: string
  readonly iphoneosSdk: string
  readonly cases: readonly FixtureCase[]
}

export const fixturesAvailable = existsSync(join(FIXTURES_DIR, 'manifest.json'))

export const loadManifest = (): FixtureManifest =>
  JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'manifest.json'), 'utf8')
  ) as FixtureManifest

export const readFixture = (...parts: string[]): Uint8Array =>
  new Uint8Array(readFileSync(join(FIXTURES_DIR, ...parts)))

export const binaryCases = (): FixtureCase[] =>
  loadManifest().cases.filter((c) => c.kind === 'binary')

export type FixtureEntry = {
  readonly path: string
  readonly kind: 'file' | 'symlink'
  readonly data?: Uint8Array
  readonly target?: string
  readonly mode: number
}

const MACHO_MAGICS = new Set([0xfeedfacf, 0xfeedface, 0xbebafeca]) // little-endian reads (fat is BE 0xcafebabe)
const isWindows = process.platform === 'win32'

const FILE_MODE = 0o644
const EXECUTABLE_MODE = 0o755
const PERMISSION_BITS = 0o777

/** The first four bytes, little-endian (0 when the file is shorter). */
const magicOf = (data: Uint8Array): number =>
  data.byteLength >= 4
    ? new DataView(data.buffer, data.byteOffset, 4).getUint32(0, true)
    : 0

/** A file's Unix mode. Windows has none, so it follows from the content, as generate.sh set it. */
const fileMode = (data: Uint8Array, stat: Stats): number => {
  if (!isWindows) return stat.mode & PERMISSION_BITS
  return MACHO_MAGICS.has(magicOf(data)) ? EXECUTABLE_MODE : FILE_MODE
}

/** '/'-separated, whatever the OS uses. */
const toPosix = (path: string): string => path.split('\\').join('/')

/** The entry for the file or symlink at `full`; `path` is its bundle-relative path. */
const entryAt = (
  full: string,
  path: string,
  stat: Stats,
  symlinks: ReadonlySet<string>
): FixtureEntry => {
  if (stat.isSymbolicLink()) {
    // Windows returns targets with '\\' separators; bundle symlink targets are always '/'
    const target = toPosix(readlinkSync(full))

    return { path, kind: 'symlink', target, mode: stat.mode & PERMISSION_BITS }
  }
  const data = new Uint8Array(readFileSync(full))
  if (isWindows && symlinks.has(path)) {
    return {
      path,
      kind: 'symlink',
      target: new TextDecoder().decode(data),
      mode: EXECUTABLE_MODE
    }
  }
  return { path, kind: 'file', data, mode: fileMode(data, stat) }
}

/**
 * Every file and symlink under a fixture bundle, with '/'-separated relative paths, sorted.
 * Windows checkouts lose symlinks (they become text files holding the target) and Unix modes, so on
 * Windows the manifest's `symlinks` list restores symlinks and modes are derived from content
 * (Mach-O → 0755, everything else → 0644), which is exactly how generate.sh created them.
 */
export const readTree = (root: string): FixtureEntry[] => {
  const bundle = basename(root)
  const symlinks = new Set(
    loadManifest().cases.find((c) => c.name === bundle)?.symlinks ?? []
  )
  const out: FixtureEntry[] = []
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name)
      const stat = lstatSync(full)
      if (stat.isDirectory()) walk(full)
      else
        out.push(entryAt(full, toPosix(relative(root, full)), stat, symlinks))
    }
  }
  walk(root)
  return out
}

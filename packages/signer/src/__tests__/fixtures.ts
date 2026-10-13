// Test-only helpers: load the golden fixtures produced by fixtures/signer/generate.sh.
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { basename, join, relative } from "node:path";

export const FIXTURES_DIR = join(import.meta.dirname, "../../../../fixtures/signer");

export interface FixtureCase {
  readonly name: string;
  readonly kind: "binary" | "bundle";
  readonly role: "main" | "appex" | "framework" | "dylib";
  readonly identifier: string;
  readonly entitlements: string | null;
  readonly minOS: string;
  /** Symlinks inside a bundle case (relative to the bundle); git on Windows checks them out as text files. */
  readonly symlinks?: readonly string[];
  readonly nested?: readonly {
    readonly path: string;
    readonly role: "appex" | "framework" | "dylib";
    readonly identifier: string;
    readonly entitlements: string | null;
  }[];
}

export interface FixtureManifest {
  readonly codesign: string;
  readonly iphoneosSdk: string;
  readonly cases: readonly FixtureCase[];
}

export const fixturesAvailable = existsSync(join(FIXTURES_DIR, "manifest.json"));

export const loadManifest = (): FixtureManifest =>
  JSON.parse(readFileSync(join(FIXTURES_DIR, "manifest.json"), "utf8")) as FixtureManifest;

export const readFixture = (...parts: string[]): Uint8Array =>
  new Uint8Array(readFileSync(join(FIXTURES_DIR, ...parts)));

export const binaryCases = (): FixtureCase[] => loadManifest().cases.filter((c) => c.kind === "binary");

export interface FixtureEntry {
  readonly path: string;
  readonly kind: "file" | "symlink";
  readonly data?: Uint8Array;
  readonly target?: string;
  readonly mode: number;
}

const MACHO_MAGICS = new Set([0xfeedfacf, 0xfeedface, 0xbebafeca]); // little-endian reads (fat is BE 0xcafebabe)
const isWindows = process.platform === "win32";

/**
 * Every file and symlink under a fixture bundle, with '/'-separated relative paths, sorted.
 * Windows checkouts lose symlinks (they become text files holding the target) and Unix modes, so on
 * Windows the manifest's `symlinks` list restores symlinks and modes are derived from content
 * (Mach-O → 0755, everything else → 0644), which is exactly how generate.sh created them.
 */
export const readTree = (root: string): FixtureEntry[] => {
  const bundle = basename(root);
  const symlinks = new Set(loadManifest().cases.find((c) => c.name === bundle)?.symlinks ?? []);
  const out: FixtureEntry[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const stat = lstatSync(full);
      const path = relative(root, full).split("\\").join("/");
      if (stat.isSymbolicLink()) {
        // Windows returns targets with '\\' separators; bundle symlink targets are always '/'
        const target = readlinkSync(full).split("\\").join("/");
        out.push({ path, kind: "symlink", target, mode: stat.mode & 0o777 });
      } else if (stat.isDirectory()) {
        walk(full);
      } else {
        const data = new Uint8Array(readFileSync(full));
        if (isWindows && symlinks.has(path)) {
          out.push({ path, kind: "symlink", target: new TextDecoder().decode(data), mode: 0o755 });
          continue;
        }
        const magic = data.byteLength >= 4 ? new DataView(data.buffer, data.byteOffset, 4).getUint32(0, true) : 0;
        const mode = isWindows ? (MACHO_MAGICS.has(magic) ? 0o755 : 0o644) : stat.mode & 0o777;
        out.push({ path, kind: "file", data, mode });
      }
    }
  };
  walk(root);
  return out;
};

// Test-only helpers: load the golden fixtures produced by fixtures/signer/generate.sh.
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { join, relative } from "node:path";

export const FIXTURES_DIR = join(import.meta.dirname, "../../../../fixtures/signer");

export interface FixtureCase {
  readonly name: string;
  readonly kind: "binary" | "bundle";
  readonly role: "main" | "appex" | "framework" | "dylib";
  readonly identifier: string;
  readonly entitlements: string | null;
  readonly minOS: string;
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

/** Every file and symlink under a fixture bundle, with '/'-separated relative paths, sorted. */
export const readTree = (root: string): FixtureEntry[] => {
  const out: FixtureEntry[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const stat = lstatSync(full);
      const path = relative(root, full).split("\\").join("/");
      if (stat.isSymbolicLink())
        out.push({ path, kind: "symlink", target: readlinkSync(full), mode: stat.mode & 0o777 });
      else if (stat.isDirectory()) walk(full);
      else out.push({ path, kind: "file", data: new Uint8Array(readFileSync(full)), mode: stat.mode & 0o777 });
    }
  };
  walk(root);
  return out;
};

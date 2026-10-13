import { ErrorCode, LoadstarError } from "@loadstar/kernel";
import { type BundleTree, isWithin, joinPath, readFile, relativeTo } from "@signer/domain/bundle/tree.ts";
import type { ResourceEntry } from "@signer/domain/code-resources/index.ts";
import { MH_BUNDLE, MH_DYLIB, MH_EXECUTE } from "@signer/domain/macho/constants.ts";
import { isMachO, parseMachO } from "@signer/domain/macho/parse.ts";
import { isPlistDict, type PlistDict, parsePlist, stringAt } from "@signer/domain/plist/index.ts";

export type BundleKind = "app" | "appex" | "framework" | "watch-app" | "xctest";

export interface CodeBundle {
  /** Path of the bundle directory relative to the main app ("" for the main app). */
  readonly path: string;
  readonly kind: BundleKind;
  readonly infoPlist: PlistDict;
  readonly identifier: string;
  /** Path of the executable relative to the main app. */
  readonly executable: string;
  /** Nesting depth (0 = main app). */
  readonly depth: number;
}

export interface LooseBinary {
  /** Path relative to the main app. */
  readonly path: string;
  /** The innermost bundle containing it. */
  readonly bundle: string;
}

const BUNDLE_SUFFIXES: readonly [string, BundleKind][] = [
  [".appex", "appex"],
  [".framework", "framework"],
  [".app", "watch-app"],
  [".xctest", "xctest"],
];

const SIGNABLE_FILETYPES = new Set([MH_EXECUTE, MH_DYLIB, MH_BUNDLE]);

const readInfoPlist = (tree: BundleTree, bundlePath: string): PlistDict | undefined => {
  const bytes = readFile(tree, joinPath(bundlePath, "Info.plist"));
  if (!bytes) return undefined;
  const value = parsePlist(bytes);
  return isPlistDict(value) ? value : undefined;
};

const describeBundle = (tree: BundleTree, path: string, kind: BundleKind): CodeBundle | undefined => {
  const infoPlist = readInfoPlist(tree, path);
  const executableName = infoPlist && stringAt(infoPlist, "CFBundleExecutable");
  const identifier = infoPlist && stringAt(infoPlist, "CFBundleIdentifier");
  if (!infoPlist || !executableName || !identifier) return undefined; // resource-only bundle
  const executable = joinPath(path, executableName);
  if (!readFile(tree, executable)) return undefined;
  return { path, kind, infoPlist, identifier, executable, depth: path === "" ? 0 : path.split("/").length };
};

/** Code bundles in the tree, deepest first (the order they must be signed in), main app last. */
export const discoverBundles = (tree: BundleTree): CodeBundle[] => {
  const main = describeBundle(tree, "", "app");
  if (!main) {
    throw new LoadstarError(ErrorCode.InvalidBundle, {
      message: "app bundle has no Info.plist with CFBundleExecutable/CFBundleIdentifier, or its executable is missing",
    });
  }

  const candidates = new Set<string>();
  for (const path of tree.keys()) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join("/");
      if (BUNDLE_SUFFIXES.some(([suffix]) => dir.endsWith(suffix))) candidates.add(dir);
    }
  }

  const nested = [...candidates]
    .map((dir) => {
      const kind = BUNDLE_SUFFIXES.find(([suffix]) => dir.endsWith(suffix))?.[1] ?? "framework";
      return describeBundle(tree, dir, kind);
    })
    .filter((bundle): bundle is CodeBundle => bundle !== undefined);

  return [...nested.sort((a, b) => b.depth - a.depth || a.path.localeCompare(b.path)), main];
};

/** Innermost code bundle that contains `path`. */
export const owningBundle = (bundles: readonly CodeBundle[], path: string): CodeBundle | undefined =>
  bundles
    .filter((bundle) => isWithin(path, bundle.path) && path !== bundle.path)
    .reduce<CodeBundle | undefined>((best, bundle) => (!best || bundle.depth > best.depth ? bundle : best), undefined);

/**
 * Mach-O executables/dylibs/bundles that are not a bundle's main executable (e.g. Frameworks/*.dylib,
 * helper tools). Detected by magic and filetype, never by extension.
 */
export const discoverLooseBinaries = (tree: BundleTree, bundles: readonly CodeBundle[]): LooseBinary[] => {
  const executables = new Set(bundles.map((bundle) => bundle.executable));
  const loose: LooseBinary[] = [];
  for (const [path, entry] of tree) {
    if (entry.kind !== "file" || executables.has(path) || !isMachO(entry.data)) continue;
    if (path.split("/").includes("_CodeSignature")) continue;
    const signable = (() => {
      try {
        return parseMachO(entry.data).slices.every((slice) => SIGNABLE_FILETYPES.has(slice.filetype));
      } catch {
        return false; // not a well-formed Mach-O: leave it as a plain resource
      }
    })();
    if (!signable) continue;
    const bundle = owningBundle(bundles, path);
    loose.push({ path, bundle: bundle?.path ?? "" });
  }
  // deepest first, so a dylib inside a framework is signed before the framework is sealed
  return loose.sort((a, b) => b.path.split("/").length - a.path.split("/").length || a.path.localeCompare(b.path));
};

/** Everything inside a bundle as CodeResources inputs (iOS seals nested bundles' files as plain resources). */
export const resourceEntriesOf = (tree: BundleTree, bundlePath: string): ResourceEntry[] => {
  const entries: ResourceEntry[] = [];
  for (const [path, entry] of tree) {
    if (!isWithin(path, bundlePath) || path === bundlePath) continue;
    const relative = relativeTo(path, bundlePath);
    entries.push(
      entry.kind === "file"
        ? { path: relative, kind: "file", data: entry.data }
        : { path: relative, kind: "symlink", target: entry.target },
    );
  }
  return entries;
};

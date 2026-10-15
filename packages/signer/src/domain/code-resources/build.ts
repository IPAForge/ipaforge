import { CODE_RESOURCES, CODE_SIGNATURE_DIR, MAS_RECEIPT_DIR } from "@signer/domain/bundle/layout.ts";
import { compileRules, matchRule, RULES_V1, RULES_V2, rulesToPlist } from "@signer/domain/code-resources/rules.ts";
import { createDict, type PlistValue } from "@signer/domain/plist/index.ts";
import { serializeXmlPlist } from "@signer/domain/plist/xml-write.ts";
import type { Hasher } from "@signer/domain/ports/hasher.ts";

/** A file or symlink in a bundle, path relative to the bundle root with '/' separators. */
export type ResourceEntry =
  | { readonly path: string; readonly kind: "file"; readonly data: Uint8Array }
  | { readonly path: string; readonly kind: "symlink"; readonly target: string };

export interface CodeResourcesOptions {
  /** `CFBundleExecutable`: excluded from sealing (its hash is in the CodeDirectory). */
  readonly mainExecutable: string;
  /** "dual" adds SHA-1 `hash` to files2 entries (only when the CD is SHA-1 + SHA-256). */
  readonly hashMode: "sha256" | "dual";
}

export interface CodeResourcesResult {
  readonly bytes: Uint8Array;
  readonly sealed: number;
  readonly omitted: number;
  readonly optional: number;
}

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Root-anchored exclusions that beat every rule (apple/bundlediskrep.cpp). */
const isExcluded = (path: string, mainExecutable: RegExp): boolean =>
  path === CODE_SIGNATURE_DIR ||
  path.startsWith(`${CODE_SIGNATURE_DIR}/`) ||
  path === CODE_RESOURCES ||
  path === MAS_RECEIPT_DIR ||
  path.startsWith(`${MAS_RECEIPT_DIR}/`) ||
  mainExecutable.test(path);

/** Builds `_CodeSignature/CodeResources` exactly as codesign does for an iOS (flat) bundle. */
export const buildCodeResources = async (
  entries: readonly ResourceEntry[],
  options: CodeResourcesOptions,
  hasher: Hasher,
): Promise<CodeResourcesResult> => {
  const v1 = compileRules(RULES_V1);
  const v2 = compileRules(RULES_V2);
  const mainExecutable = new RegExp(`^${escapeRegex(options.mainExecutable)}$`);

  const files: [string, PlistValue][] = [];
  const files2: [string, PlistValue][] = [];
  let omitted = 0;
  let optional = 0;

  for (const entry of entries) {
    if (isExcluded(entry.path, mainExecutable)) continue;

    // files (v1): regular files only, SHA-1
    const ruleV1 = matchRule(v1, entry.path);
    if (entry.kind === "file" && ruleV1 && !ruleV1.omit) {
      const sha1 = await hasher.digest("sha1", entry.data);
      files.push([
        entry.path,
        ruleV1.optional
          ? createDict([
              ["hash", sha1],
              ["optional", true],
            ])
          : sha1,
      ]);
    }

    // files2 (v2): files and symlinks
    const ruleV2 = matchRule(v2, entry.path);
    if (!ruleV2 || ruleV2.omit) {
      omitted++;
      continue;
    }
    const sealed: [string, PlistValue][] = [];
    if (entry.kind === "symlink") {
      sealed.push(["symlink", entry.target]);
    } else {
      if (options.hashMode === "dual") sealed.push(["hash", await hasher.digest("sha1", entry.data)]);
      sealed.push(["hash2", await hasher.digest("sha256", entry.data)]);
    }
    if (ruleV2.optional) {
      sealed.push(["optional", true]);
      optional++;
    }
    files2.push([entry.path, createDict(sealed)]);
  }

  const plist = createDict([
    ["files", createDict(files)],
    ["files2", createDict(files2)],
    ["rules", rulesToPlist(RULES_V1)],
    ["rules2", rulesToPlist(RULES_V2)],
  ]);
  return { bytes: serializeXmlPlist(plist), sealed: files2.length, omitted, optional };
};

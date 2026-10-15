import type { Logger } from "@loadstar/kernel";
import { hashAlgorithmsFor } from "@signer/application/policy.ts";
import { type EntitlementsInput, type SigningMode, signBinary } from "@signer/application/sign-binary.ts";
import {
  type CodeBundle,
  discoverBundles,
  discoverLooseBinaries,
  resourceEntriesOf,
} from "@signer/domain/bundle/discover.ts";
import {
  CODE_RESOURCES_PATH,
  CODE_SIGNATURE_DIR,
  DEFAULT_FILE_MODE,
  EMBEDDED_PROFILE,
  INFO_PLIST,
  SC_INFO_DIR,
} from "@signer/domain/bundle/layout.ts";
import { type BundleTree, baseName, joinPath, readFile, removePath, writeFile } from "@signer/domain/bundle/tree.ts";
import { buildCodeResources } from "@signer/domain/code-resources/index.ts";
import {
  type Overrides,
  resolveLimits,
  resolvePolicy,
  type SignerLimits,
  type SigningPolicy,
} from "@signer/domain/config.ts";
import { parseMachO } from "@signer/domain/macho/parse.ts";
import type { Hasher } from "@signer/domain/ports/hasher.ts";

/** Per-bundle signing configuration, decided by the caller (e.g. from provisioning profiles). */
export interface BundleSigningConfig {
  readonly signing: SigningMode;
  /** Entitlements for the bundle's executable (apps and appexes; ignored for frameworks). */
  readonly entitlements?: EntitlementsInput;
  /** Raw provisioning profile written as `embedded.mobileprovision` before sealing. */
  readonly provisioningProfile?: Uint8Array;
}

export type SignBundleProgress =
  | { readonly type: "binary"; readonly path: string; readonly index: number; readonly total: number }
  | {
      readonly type: "bundle";
      readonly path: string;
      readonly identifier: string;
      readonly index: number;
      readonly total: number;
    };

export interface SignBundleOptions {
  readonly configFor: (bundle: CodeBundle) => BundleSigningConfig;
  /** Identifier for loose Mach-O files (default: codesign's canonical file name, e.g. `libFoo`). */
  readonly looseIdentifier?: (path: string) => string;
  readonly onProgress?: (event: SignBundleProgress) => void;
  /** Page size, hash algorithms and CMS reservation (defaults follow Apple codesign 26). */
  readonly policy?: Partial<SigningPolicy>;
  /** Parser limits (defaults: DEFAULT_SIGNER_LIMITS). */
  readonly limits?: Overrides<SignerLimits>;
  readonly signal?: AbortSignal;
}

export interface SignBundleDeps {
  readonly hasher: Hasher;
  readonly logger: Logger;
  readonly clock: { now(): Date };
}

export interface SignedBundleSummary {
  readonly bundles: readonly { readonly path: string; readonly identifier: string; readonly cdhash: Uint8Array }[];
  readonly looseBinaries: number;
}

/**
 * codesign's canonical identifier for a file: drop the directory and the last extension unless
 * it starts with a digit (`libFoo.dylib` → `libFoo`, `libz.1.2.dylib` → `libz.1.2`).
 */
export const canonicalIdentifier = (path: string): string => {
  const name = baseName(path);
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return name;
  const extension = name.slice(dot + 1);
  return /^\d/.test(extension) ? name : name.slice(0, dot);
};

/** Stale signing artefacts that must not survive re-signing. */
const cleanBundle = (tree: BundleTree, logger: Logger): void => {
  for (const path of [...tree.keys()]) {
    const parts = path.split("/");
    const index = parts.findIndex((part) => part === CODE_SIGNATURE_DIR || part === SC_INFO_DIR);
    if (index >= 0) removePath(tree, parts.slice(0, index + 1).join("/"));
  }
  logger.debug(`removed stale ${CODE_SIGNATURE_DIR}/${SC_INFO_DIR} directories`);
};

/**
 * Signs every code bundle and loose binary in `tree`, innermost first, mutating the tree in
 * place. Matches Apple codesign's bundle layout for iOS (flat CodeResources, profiles sealed).
 */
export const signBundle = async (
  tree: BundleTree,
  options: SignBundleOptions,
  deps: SignBundleDeps,
): Promise<SignedBundleSummary> => {
  const logger = deps.logger.child({ scope: "bundle" });
  cleanBundle(tree, logger);

  const limits = resolveLimits(options.limits);
  const policy = resolvePolicy(options.policy);
  const shared = { policy, limits, ...(options.signal ? { signal: options.signal } : {}) };
  const bundles = discoverBundles(tree, limits);
  const loose = discoverLooseBinaries(tree, bundles, limits);
  const configs = new Map(bundles.map((bundle) => [bundle.path, options.configFor(bundle)]));
  const looseIdentifier = options.looseIdentifier ?? canonicalIdentifier;
  logger.info("discovered code", {
    bundles: bundles.map((b) => `${b.path || "."} (${b.kind})`),
    looseBinaries: loose.map((l) => l.path),
  });

  // Each loose binary is signed before the bundle that contains it is sealed; bundles go deepest first.
  const work: ({ type: "binary"; path: string; bundle: string } | { type: "bundle"; bundle: CodeBundle })[] = [];
  for (const bundle of bundles) {
    for (const binary of loose.filter((l) => l.bundle === bundle.path)) work.push({ type: "binary", ...binary });
    work.push({ type: "bundle", bundle });
  }

  const signed: { path: string; identifier: string; cdhash: Uint8Array }[] = [];
  for (const [index, item] of work.entries()) {
    options.signal?.throwIfAborted();

    if (item.type === "binary") {
      options.onProgress?.({ type: "binary", path: item.path, index, total: work.length });
      const config = configs.get(item.bundle);
      const data = readFile(tree, item.path);
      if (!config || !data) continue;
      const result = await signBinary(
        data,
        { identifier: looseIdentifier(item.path), signing: config.signing, ...shared },
        deps,
      );
      writeFile(tree, item.path, result.bytes);
      continue;
    }

    const { bundle } = item;
    options.onProgress?.({
      type: "bundle",
      path: bundle.path,
      identifier: bundle.identifier,
      index,
      total: work.length,
    });
    const config = configs.get(bundle.path) as BundleSigningConfig;
    if (config.provisioningProfile) {
      writeFile(tree, joinPath(bundle.path, EMBEDDED_PROFILE), config.provisioningProfile, DEFAULT_FILE_MODE);
    }

    const executable = readFile(tree, bundle.executable) as Uint8Array;
    const agile = hashAlgorithmsFor(parseMachO(executable, limits.machO).slices, policy.hashAlgorithms).includes(
      "sha1",
    );
    const resources = await buildCodeResources(
      resourceEntriesOf(tree, bundle.path),
      { mainExecutable: baseName(bundle.executable), hashMode: agile ? "dual" : "sha256" },
      deps.hasher,
    );
    writeFile(tree, joinPath(bundle.path, CODE_RESOURCES_PATH), resources.bytes, DEFAULT_FILE_MODE);

    const infoPlist = readFile(tree, joinPath(bundle.path, INFO_PLIST));
    const result = await signBinary(
      executable,
      {
        identifier: bundle.identifier,
        signing: config.signing,
        ...(config.entitlements && bundle.kind !== "framework" ? { entitlements: config.entitlements } : {}),
        ...(infoPlist ? { infoPlist } : {}),
        codeResources: resources.bytes,
        ...shared,
      },
      deps,
    );
    writeFile(tree, bundle.executable, result.bytes);
    signed.push({ path: bundle.path, identifier: bundle.identifier, cdhash: result.cdhashes[0] as Uint8Array });
    logger.info("sealed bundle", {
      path: bundle.path || ".",
      identifier: bundle.identifier,
      sealed: resources.sealed,
      omitted: resources.omitted,
    });
  }

  return { bundles: signed, looseBinaries: loose.length };
};

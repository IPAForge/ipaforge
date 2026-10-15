import { ErrorCode, LoadstarError, type Logger } from "@loadstar/kernel";
import { embeddedEntitlements } from "@signer/application/embedded-entitlements.ts";
import type { EntitlementsInput } from "@signer/application/sign-binary.ts";
import { type CodeBundle, discoverBundles } from "@signer/domain/bundle/discover.ts";
import { type IdentityRewrite, rewriteInfoPlist, rewriteNestedId } from "@signer/domain/bundle/info-plist.ts";
import { INFO_PLIST } from "@signer/domain/bundle/layout.ts";
import { type BundleTree, isWithin, joinPath, readFile, removePath, writeFile } from "@signer/domain/bundle/tree.ts";
import { type Overrides, resolveLimits, type SignerLimits } from "@signer/domain/config.ts";
import { createDict, type PlistDict, serializeXmlPlist } from "@signer/domain/plist/index.ts";
import {
  describeProfile,
  type ProvisioningProfile,
  parseProvisioningProfile,
  profileContainsCertificate,
  profileCoversBundle,
} from "@signer/infrastructure/profile/profile.ts";

export interface ReconcileOptions {
  readonly teamId: string;
  /** New bundle ID for the main app (e.g. `com.SideStore.SideStore.TEAMID`). */
  readonly newMainBundleId: string;
  /** Leaf certificate the app will be signed with; must be listed in every profile. */
  readonly certificate: Uint8Array;
  /** Raw provisioning profiles keyed by the **new** bundle ID they provision. */
  readonly profiles: ReadonlyMap<string, Uint8Array>;
  /** Old app group → new app group. */
  readonly appGroups?: ReadonlyMap<string, string>;
  /** Target device; checked against each profile's ProvisionedDevices. */
  readonly deviceUdid?: string;
  readonly now: Date;
  /** Remove extensions/watch apps without a profile instead of failing. */
  readonly pruneUnprovisioned?: boolean;
  /** Parser limits (defaults: DEFAULT_SIGNER_LIMITS). */
  readonly limits?: Overrides<SignerLimits>;
}

export interface BundleProvisioning {
  readonly entitlements: EntitlementsInput;
  readonly provisioningProfile: Uint8Array;
  readonly profile: ProvisioningProfile;
}

export interface ReconcileResult {
  /** Keyed by bundle path relative to the main app ("" = main app). */
  readonly provisioning: ReadonlyMap<string, BundleProvisioning>;
  /** Old bundle ID → new bundle ID. */
  readonly bundleIds: ReadonlyMap<string, string>;
  readonly pruned: readonly string[];
}

const PROVISIONED_KINDS = new Set<CodeBundle["kind"]>(["app", "appex", "watch-app"]);

const fail = (code: ErrorCode, message: string, data: Record<string, unknown>): never => {
  throw new LoadstarError(code, { message, data });
};

const validateProfile = (profile: ProvisioningProfile, bundleId: string, options: ReconcileOptions): void => {
  const data = { bundleId, profile: describeProfile(profile) };
  if (profile.teamId !== options.teamId) {
    fail(ErrorCode.ProfileMismatch, `profile belongs to team ${profile.teamId}, not ${options.teamId}`, data);
  }
  if (!profileCoversBundle(profile, bundleId)) {
    fail(ErrorCode.ProfileMismatch, `profile is for ${profile.applicationIdentifier}, not ${bundleId}`, data);
  }
  if (profile.expirationDate.getTime() <= options.now.getTime()) {
    fail(ErrorCode.ProfileExpired, "provisioning profile has expired", data);
  }
  if (!profileContainsCertificate(profile, options.certificate)) {
    fail(ErrorCode.CertificateNotInProfile, "signing certificate is not listed in the profile", data);
  }
  if (
    options.deviceUdid &&
    !profile.provisionsAllDevices &&
    !profile.provisionedDevices.some((udid) => udid.toLowerCase() === options.deviceUdid?.toLowerCase())
  ) {
    fail(ErrorCode.DeviceNotProvisioned, "the target device is not in the profile", data);
  }
};

/** Profile entitlements with a wildcard application-identifier made concrete for this bundle. */
const entitlementsFromProfile = (profile: ProvisioningProfile, bundleId: string): PlistDict =>
  createDict(
    Object.entries(profile.entitlements).map(([key, value]) =>
      key === "application-identifier" && typeof value === "string" && value.endsWith("*")
        ? [key, `${profile.teamId}.${bundleId}`]
        : [key, value],
    ),
  );

/**
 * Prepares an app for sideloading in place: new bundle IDs, rewritten Info.plists, and the
 * entitlements + profile each executable must be signed with (signer-spec §8).
 */
export const reconcileForSideload = (tree: BundleTree, options: ReconcileOptions, logger: Logger): ReconcileResult => {
  const limits = resolveLimits(options.limits);
  const bundles = discoverBundles(tree, limits);
  const main = bundles.at(-1) as CodeBundle;
  const rewrite: IdentityRewrite = {
    oldMainId: main.identifier,
    newMainId: options.newMainBundleId,
    appGroups: options.appGroups ?? new Map(),
  };

  const provisioning = new Map<string, BundleProvisioning>();
  const bundleIds = new Map<string, string>();
  const pruned: string[] = [];

  // Main app first, so a failure on the app itself is reported before any extension.
  for (const bundle of [main, ...bundles.slice(0, -1)]) {
    if (!PROVISIONED_KINDS.has(bundle.kind)) continue;
    if (pruned.some((path) => isWithin(bundle.path, path))) continue;

    const newId = rewriteNestedId(bundle.identifier, rewrite);
    const raw = options.profiles.get(newId);
    if (!raw) {
      if (bundle.path !== "" && options.pruneUnprovisioned) {
        removePath(tree, bundle.path);
        pruned.push(bundle.path);
        logger.warn("removed extension without a provisioning profile", { path: bundle.path, bundleId: newId });
        continue;
      }
      fail(ErrorCode.ProfileMismatch, `no provisioning profile for ${newId}`, { bundleId: newId, path: bundle.path });
    }

    const profile = parseProvisioningProfile(raw as Uint8Array, limits.plist);
    validateProfile(profile, newId, options);
    const entitlements = entitlementsFromProfile(profile, newId);

    const original = embeddedEntitlements(readFile(tree, bundle.executable), limits)?.dict;
    const dropped = original ? Object.keys(original).filter((key) => !(key in entitlements)) : [];
    if (dropped.length)
      logger.warn("entitlements not granted by the profile were dropped", { bundleId: newId, keys: dropped });

    const info = rewriteInfoPlist(bundle.infoPlist, newId, rewrite);
    writeFile(tree, joinPath(bundle.path, INFO_PLIST), serializeXmlPlist(info));

    provisioning.set(bundle.path, {
      entitlements: { bytes: serializeXmlPlist(entitlements), dict: entitlements },
      provisioningProfile: profile.raw,
      profile,
    });
    bundleIds.set(bundle.identifier, newId);
    logger.info("reconciled bundle", {
      path: bundle.path || ".",
      from: bundle.identifier,
      to: newId,
      profile: profile.uuid,
    });
  }

  return { provisioning, bundleIds, pruned };
};

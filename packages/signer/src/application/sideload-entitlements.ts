// The entitlements a sideloaded executable is signed with: its own profile's, made concrete (signer-spec §8.2).
import { createDict, type Logger, type PlistDict } from "@loadstar/kernel";
import { assignKey } from "@signer/domain/dict.ts";
import { concreteKeychainGroups } from "@signer/domain/entitlements/keychain-groups.ts";
import { APPLICATION_IDENTIFIER, KEYCHAIN_ACCESS_GROUPS } from "@signer/domain/entitlements/names.ts";
import { isWildcard } from "@signer/domain/entitlements/pattern.ts";
import type { ProvisioningProfile } from "@signer/infrastructure/profile/profile.ts";

interface EntitlementsContext {
  readonly bundleId: string;
  readonly logger: Logger;
}

/** Profile entitlements with a wildcard application-identifier made concrete for this bundle. */
const profileEntitlements = (profile: ProvisioningProfile, bundleId: string): PlistDict =>
  createDict(
    Object.entries(profile.entitlements).map(([key, value]) =>
      key === APPLICATION_IDENTIFIER && typeof value === "string" && isWildcard(value)
        ? [key, `${profile.teamId}.${bundleId}`]
        : [key, value],
    ),
  );

/** The executable's own keychain groups under the new team, when the profile's wildcard allows them. */
const withConcreteKeychainGroups = (
  granted: PlistDict,
  original: PlistDict | undefined,
  teamId: string,
  context: EntitlementsContext,
): PlistDict => {
  const keychain = concreteKeychainGroups(granted, original, teamId);
  if (!keychain) return granted;
  if (keychain.dropped.length > 0) {
    context.logger.warn("keychain access groups not allowed by the profile were dropped", {
      bundleId: context.bundleId,
      groups: keychain.dropped,
    });
  }
  return assignKey(granted, KEYCHAIN_ACCESS_GROUPS, [...keychain.groups]);
};

/** Entitlements the executable had that the profile does not grant are dropped; say so. */
const warnDroppedEntitlements = (
  original: PlistDict | undefined,
  granted: PlistDict,
  context: EntitlementsContext,
): void => {
  const dropped = original ? Object.keys(original).filter((key) => !(key in granted)) : [];
  if (dropped.length === 0) return;
  context.logger.warn("entitlements not granted by the profile were dropped", {
    bundleId: context.bundleId,
    keys: dropped,
  });
};

/** What to sign one executable with, given its profile and the entitlements it was signed with before. */
export const sideloadEntitlements = (
  profile: ProvisioningProfile,
  original: PlistDict | undefined,
  context: EntitlementsContext,
): PlistDict => {
  const granted = profileEntitlements(profile, context.bundleId);
  const entitlements = withConcreteKeychainGroups(granted, original, profile.teamId, context);
  warnDroppedEntitlements(original, entitlements, context);
  return entitlements;
};

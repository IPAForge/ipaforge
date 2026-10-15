// The identities a sideloaded app takes under a team (signer-spec §8.1–8.2), planned from an inspection.
import { compact } from "@loadstar/kernel";
import { type IdentityRewrite, rewriteNestedId } from "@signer/domain/bundle/info-plist.ts";
import { APP_GROUP_PREFIX } from "@signer/domain/entitlements/names.ts";
import type { IpaInspection } from "@signer/domain/sideload/inspection.ts";

/** One App ID to register: the new bundle identifier and a display name. */
export interface BundleIdentity {
  readonly identifier: string;
  readonly name: string;
}

export interface SideloadIdentityPlan {
  /** `<original main ID>.<TEAMID>`. */
  readonly newMainBundleId: string;
  /** Main app first, then every provisioned nested bundle. */
  readonly bundles: readonly BundleIdentity[];
  /** `group.<newMainBundleId>`, when the app declares any app group. */
  readonly appGroup?: string;
  /** Every declared app group → `appGroup` (for `ReconcileOptions.appGroups`). */
  readonly appGroups: ReadonlyMap<string, string>;
}

const declaredAppGroups = (inspection: IpaInspection): string[] => [
  ...new Set([...inspection.appGroups, ...inspection.altAppGroups]),
];

/** New bundle IDs, App ID names and the app group for installing `inspection` under `teamId`. */
export const planSideloadIdentity = (inspection: IpaInspection, teamId: string): SideloadIdentityPlan => {
  const newMainBundleId = `${inspection.app.identifier}.${teamId}`;
  const rewrite: IdentityRewrite = {
    oldMainId: inspection.app.identifier,
    newMainId: newMainBundleId,
    appGroups: new Map(),
  };
  const bundles: BundleIdentity[] = [
    { identifier: newMainBundleId, name: inspection.app.name },
    ...inspection.nested.map((bundle) => ({
      identifier: rewriteNestedId(bundle.identifier, rewrite),
      name: bundle.name,
    })),
  ];

  const oldGroups = declaredAppGroups(inspection);
  const appGroup = oldGroups.length > 0 ? `${APP_GROUP_PREFIX}${newMainBundleId}` : undefined;
  const appGroups = new Map(appGroup ? oldGroups.map((group) => [group, appGroup]) : []);
  return compact({ newMainBundleId, bundles, appGroup, appGroups });
};

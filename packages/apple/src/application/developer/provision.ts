// `provisionApp`: everything the signer needs for one install, inside the free-account limits. The App ID budget is
// checked before anything is written.

import {
  assignAppGroup,
  createAppId,
  downloadProfile,
  ensureAppGroup,
  listAppIds,
} from "@apple/application/developer/app-ids.ts";
import type { DeveloperContext } from "@apple/application/developer/context.ts";
import { registerDevice } from "@apple/application/developer/devices.ts";
import { type AppId, type AppIdPlan, planAppIds, type Team } from "@apple/domain/developer.ts";
import { compact, ErrorCode, LoadstarError } from "@loadstar/kernel";

export interface BundleRequest {
  /** Bundle identifier after sideload renaming, e.g. `com.SideStore.SideStore.ABCDE12345`. */
  readonly identifier: string;
  readonly name: string;
}

export interface ProvisionRequest {
  readonly team: Team;
  readonly device: { readonly udid: string; readonly name: string };
  /** Main app first, then its extensions. */
  readonly bundles: readonly BundleRequest[];
  /** App group to register and assign to every bundle (e.g. `group.com.SideStore.SideStore.ABCDE12345`). */
  readonly appGroup?: string;
}

export interface ProvisionResult {
  readonly appIds: ReadonlyMap<string, AppId>;
  /** Raw `.mobileprovision` bytes per bundle identifier, for the signer. */
  readonly profiles: ReadonlyMap<string, Uint8Array>;
  readonly plan: AppIdPlan;
}

const assertEnoughAppIds = (plan: AppIdPlan): void => {
  if (plan.enough) return;
  throw new LoadstarError(ErrorCode.AppIdQuotaExceeded, {
    data: compact({
      needed: plan.create.length,
      available: plan.available,
      nextSlotAt: plan.nextSlotAt?.toISOString(),
    }),
  });
};

/** The planned App IDs plus the ones created now, by bundle identifier. */
const resolveAppIds = async (
  ctx: DeveloperContext,
  team: Team,
  bundles: readonly BundleRequest[],
  plan: AppIdPlan,
): Promise<Map<string, AppId>> => {
  const byIdentifier = new Map(plan.reuse.map((appId) => [appId.identifier, appId]));
  for (const bundle of bundles) {
    if (byIdentifier.has(bundle.identifier)) continue;
    byIdentifier.set(bundle.identifier, await createAppId(ctx, team, bundle.identifier, bundle.name));
  }
  return byIdentifier;
};

const assignGroupToAll = async (
  ctx: DeveloperContext,
  team: Team,
  identifier: string,
  appIds: Iterable<AppId>,
): Promise<void> => {
  const group = await ensureAppGroup(ctx, team, identifier);
  for (const appId of appIds) await assignAppGroup(ctx, team, appId, group);
};

const downloadProfiles = async (
  ctx: DeveloperContext,
  team: Team,
  appIds: ReadonlyMap<string, AppId>,
): Promise<Map<string, Uint8Array>> => {
  const profiles = new Map<string, Uint8Array>();
  for (const [identifier, appId] of appIds) profiles.set(identifier, (await downloadProfile(ctx, team, appId)).data);
  return profiles;
};

export const provisionApp = async (ctx: DeveloperContext, request: ProvisionRequest): Promise<ProvisionResult> => {
  const { team, bundles } = request;
  await registerDevice(ctx, team, request.device.udid, request.device.name);
  const { appIds, quota } = await listAppIds(ctx, team);
  const plan = planAppIds(
    bundles.map((bundle) => bundle.identifier),
    appIds,
    quota,
    ctx.deps.clock.now(),
  );
  assertEnoughAppIds(plan);
  const byIdentifier = await resolveAppIds(ctx, team, bundles, plan);
  if (request.appGroup) await assignGroupToAll(ctx, team, request.appGroup, byIdentifier.values());
  const profiles = await downloadProfiles(ctx, team, byIdentifier);
  ctx.deps.logger.info("provisioned app", { bundles: bundles.length, created: plan.create.length });
  return { appIds: byIdentifier, profiles, plan };
};

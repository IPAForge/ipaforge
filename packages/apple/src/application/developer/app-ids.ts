// App IDs, app groups and the provisioning profile of an App ID.

import type { DeveloperContext } from "@apple/application/developer/context.ts";
import {
  APP_GROUPS_FEATURE,
  type AppGroup,
  type AppId,
  type AppIdPlan,
  type AppIdQuota,
  normalizeAppIdName,
  type ProvisioningProfile,
  planAppIds,
  type Team,
} from "@apple/domain/developer.ts";
import { toAppGroup, toAppGroups, toAppIds, toCreatedAppId, toProfile } from "@apple/infrastructure/developer/parse.ts";

export const listAppIds = async (ctx: DeveloperContext, team: Team): Promise<{ appIds: AppId[]; quota: AppIdQuota }> =>
  toAppIds(await ctx.teamRequest(team, "listAppIds"), ctx.skip("App ID"));

export const createAppId = async (
  ctx: DeveloperContext,
  team: Team,
  identifier: string,
  name: string,
): Promise<AppId> => {
  const response = await ctx.teamRequest(team, "addAppId", [
    ["identifier", identifier],
    ["name", normalizeAppIdName(name)],
  ]);
  ctx.deps.logger.info("created App ID", { identifier });
  return toCreatedAppId(response);
};

export const deleteAppId = async (ctx: DeveloperContext, team: Team, appId: AppId): Promise<void> => {
  await ctx.teamRequest(team, "deleteAppId", [["appIdId", appId.id]]);
};

/** Plans App IDs for `identifiers` without changing anything. */
export const planTeamAppIds = async (
  ctx: DeveloperContext,
  team: Team,
  identifiers: readonly string[],
): Promise<AppIdPlan> => {
  const { appIds, quota } = await listAppIds(ctx, team);
  return planAppIds(identifiers, appIds, quota, ctx.deps.clock.now());
};

export const listAppGroups = async (ctx: DeveloperContext, team: Team): Promise<AppGroup[]> =>
  toAppGroups(await ctx.teamRequest(team, "listApplicationGroups"), ctx.skip("app group"));

export const ensureAppGroup = async (ctx: DeveloperContext, team: Team, identifier: string): Promise<AppGroup> => {
  const existing = (await listAppGroups(ctx, team)).find((group) => group.identifier === identifier);
  if (existing) return existing;
  const response = await ctx.teamRequest(team, "addApplicationGroup", [
    ["identifier", identifier],
    ["name", normalizeAppIdName(identifier)],
  ]);
  return toAppGroup(response);
};

/** Enables App Groups on the App ID when needed, then assigns `group` to it. */
export const assignAppGroup = async (
  ctx: DeveloperContext,
  team: Team,
  appId: AppId,
  group: AppGroup,
): Promise<void> => {
  if (appId.features[APP_GROUPS_FEATURE] !== true) {
    await ctx.teamRequest(team, "updateAppId", [
      ["appIdId", appId.id],
      [APP_GROUPS_FEATURE, true],
    ]);
  }
  await ctx.teamRequest(team, "assignApplicationGroupToAppId", [
    ["appIdId", appId.id],
    ["applicationGroups", group.id],
  ]);
};

export const downloadProfile = async (ctx: DeveloperContext, team: Team, appId: AppId): Promise<ProvisioningProfile> =>
  toProfile(await ctx.teamRequest(team, "downloadTeamProvisioningProfile", [["appIdId", appId.id]]));

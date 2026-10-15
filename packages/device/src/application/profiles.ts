import type { DeviceContext } from "@device/application/context.ts";
import { openInstallationProxy, openMisagent, withClient } from "@device/application/services.ts";
import type { DeviceSession } from "@device/application/session.ts";
import { bundleIdOf, type DeviceProfile } from "@device/domain/profiles.ts";

export interface RemoveStaleOptions {
  readonly now: Date;
  /** Also remove this team's profiles whose app is no longer installed. */
  readonly teamId?: string;
}

/** Profiles to remove: expired ones, and (with `teamId`) the team's profiles for apps that are gone. */
export const staleProfiles = (
  profiles: readonly DeviceProfile[],
  installedBundleIds: ReadonlySet<string>,
  options: RemoveStaleOptions,
): DeviceProfile[] =>
  profiles.filter((profile) => {
    if (profile.expirationDate && profile.expirationDate.getTime() <= options.now.getTime()) return true;
    if (!options.teamId || profile.teamId !== options.teamId || !profile.applicationIdentifier) return false;
    const bundleId = bundleIdOf(profile.applicationIdentifier);
    return !bundleId.includes("*") && !installedBundleIds.has(bundleId);
  });

export const listProfiles = async (ctx: DeviceContext, session: DeviceSession): Promise<DeviceProfile[]> =>
  withClient(await openMisagent(ctx, session), (misagent) => misagent.list());

export const installProfile = async (ctx: DeviceContext, session: DeviceSession, profile: Uint8Array): Promise<void> =>
  withClient(await openMisagent(ctx, session), (misagent) => misagent.install(profile));

export const removeProfile = async (ctx: DeviceContext, session: DeviceSession, uuid: string): Promise<void> =>
  withClient(await openMisagent(ctx, session), (misagent) => misagent.remove(uuid));

/** Removes stale profiles (see `staleProfiles`) and returns what was removed. */
export const removeStaleProfiles = async (
  ctx: DeviceContext,
  session: DeviceSession,
  options: RemoveStaleOptions,
): Promise<DeviceProfile[]> => {
  const installed = options.teamId
    ? new Set(
        (await withClient(await openInstallationProxy(ctx, session), (proxy) => proxy.browse())).map(
          (app) => app.bundleId,
        ),
      )
    : new Set<string>();
  return withClient(await openMisagent(ctx, session), async (misagent) => {
    const stale = staleProfiles(await misagent.list(), installed, options);
    for (const profile of stale) {
      await misagent.remove(profile.uuid);
      ctx.deps.logger.info("removed stale profile", { name: profile.name, uuid: profile.uuid });
    }
    return stale;
  });
};

// Provisioning profiles on the device, through misagent.
import { installedBundleIds } from "@device/application/apps.ts";
import type { DeviceContext } from "@device/application/context.ts";
import { useMisagent } from "@device/application/services.ts";
import type { DeviceSession } from "@device/application/session.ts";
import { type DeviceProfile, type RemoveStaleOptions, staleProfiles } from "@device/domain/profiles.ts";

export const listProfiles = (ctx: DeviceContext, session: DeviceSession): Promise<DeviceProfile[]> =>
  useMisagent(ctx, session, (misagent) => misagent.list());

export const installProfile = (ctx: DeviceContext, session: DeviceSession, profile: Uint8Array): Promise<void> =>
  useMisagent(ctx, session, (misagent) => misagent.install(profile));

export const removeProfile = (ctx: DeviceContext, session: DeviceSession, uuid: string): Promise<void> =>
  useMisagent(ctx, session, (misagent) => misagent.remove(uuid));

/** Removes stale profiles (see `staleProfiles`) and returns what was removed. */
export const removeStaleProfiles = async (
  ctx: DeviceContext,
  session: DeviceSession,
  options: RemoveStaleOptions,
): Promise<DeviceProfile[]> => {
  // Installed apps only matter for the team's orphaned profiles.
  const installed = new Set(options.teamId ? await installedBundleIds(ctx, session) : []);
  return useMisagent(ctx, session, async (misagent) => {
    const stale = staleProfiles(await misagent.list(), installed, options);
    for (const profile of stale) {
      await misagent.remove(profile.uuid);
      ctx.deps.logger.info("removed stale profile", { name: profile.name, uuid: profile.uuid });
    }
    return stale;
  });
};

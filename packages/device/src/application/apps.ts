// Installed apps: list, look up and uninstall through installation_proxy.
import type { DeviceContext } from "@device/application/context.ts";
import { useInstallationProxy } from "@device/application/services.ts";
import type { DeviceSession } from "@device/application/session.ts";
import type { InstalledApp } from "@device/infrastructure/installation-proxy/apps.ts";
import type { ApplicationType } from "@device/infrastructure/installation-proxy/client.ts";
import { compact } from "@loadstar/kernel";

export const listApps = (
  ctx: DeviceContext,
  session: DeviceSession,
  applicationType?: ApplicationType,
): Promise<InstalledApp[]> => useInstallationProxy(ctx, session, (proxy) => proxy.browse(compact({ applicationType })));

/** Bundle IDs of the user apps on the device. */
export const installedBundleIds = async (ctx: DeviceContext, session: DeviceSession): Promise<string[]> =>
  (await useInstallationProxy(ctx, session, (proxy) => proxy.browse())).map((app) => app.bundleId);

export const lookupApps = (
  ctx: DeviceContext,
  session: DeviceSession,
  bundleIds: readonly string[],
): Promise<Map<string, InstalledApp>> => useInstallationProxy(ctx, session, (proxy) => proxy.lookup(bundleIds));

export const uninstallApp = (ctx: DeviceContext, session: DeviceSession, bundleId: string): Promise<void> =>
  useInstallationProxy(ctx, session, (proxy) => proxy.uninstall(bundleId));

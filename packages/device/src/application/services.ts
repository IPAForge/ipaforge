import type { DeviceContext } from "@device/application/context.ts";
import type { DeviceSession } from "@device/application/session.ts";
import { Service } from "@device/domain/constants.ts";
import { type AfcClient, type AfcClientOptions, createAfcClient } from "@device/infrastructure/afc/client.ts";
import { revealDeveloperModeOption } from "@device/infrastructure/amfi/client.ts";
import { type ContainerMode, vendContainer } from "@device/infrastructure/house-arrest/client.ts";
import { createInstallationProxy, type InstallationProxy } from "@device/infrastructure/installation-proxy/client.ts";
import { createMisagent, type Misagent } from "@device/infrastructure/misagent/client.ts";

const afcOptions = (ctx: DeviceContext): AfcClientOptions => ({
  logger: ctx.deps.logger,
  maxMessageBytes: ctx.deps.config.maxMessageBytes,
  writeChunkBytes: ctx.deps.config.afcWriteChunkBytes,
  readChunkBytes: ctx.deps.config.afcReadChunkBytes,
});

const plistOptions = (ctx: DeviceContext) => ({ limits: ctx.limits, logger: ctx.deps.logger });

/** The media/staging file system (`/var/mobile/Media`). */
export const openAfc = async (ctx: DeviceContext, session: DeviceSession): Promise<AfcClient> =>
  createAfcClient(await session.startService(Service.Afc), afcOptions(ctx));

/** An app's container or Documents folder, as an AFC file system. */
export const openAppContainer = async (
  ctx: DeviceContext,
  session: DeviceSession,
  bundleId: string,
  mode: ContainerMode = "container",
): Promise<AfcClient> => {
  const link = await session.startService(Service.HouseArrest);
  try {
    return await vendContainer(link, bundleId, mode, { ...plistOptions(ctx), afc: afcOptions(ctx) });
  } catch (error) {
    await link.close();
    throw error;
  }
};

export const openInstallationProxy = async (ctx: DeviceContext, session: DeviceSession): Promise<InstallationProxy> =>
  createInstallationProxy(await session.startService(Service.InstallationProxy), plistOptions(ctx));

export const openMisagent = async (ctx: DeviceContext, session: DeviceSession): Promise<Misagent> =>
  createMisagent(await session.startService(Service.Misagent), plistOptions(ctx));

export const revealDeveloperMode = async (ctx: DeviceContext, session: DeviceSession): Promise<void> => {
  const link = await session.startService(Service.Amfi);
  try {
    await revealDeveloperModeOption(link, plistOptions(ctx));
  } finally {
    await link.close();
  }
};

/** Runs `use` with a service client and always closes it. */
export const withClient = async <C extends { close(): Promise<void> }, T>(
  client: C,
  use: (client: C) => Promise<T>,
): Promise<T> => {
  try {
    return await use(client);
  } finally {
    await client.close();
  }
};

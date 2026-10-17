// Opens the lockdown services a session uses, each as a client that owns its connection.
import type { DeviceContext } from '@device/application/context.ts'
import type { DeviceSession } from '@device/application/types.ts'
import { Service } from '@device/domain/constants.ts'
import { createAfcClient } from '@device/infrastructure/afc/client.ts'
import type {
  AfcClient,
  AfcClientOptions
} from '@device/infrastructure/afc/types.ts'
import { revealDeveloperModeOption } from '@device/infrastructure/amfi/client.ts'
import { closeOnError, withClient } from '@device/infrastructure/closeable.ts'
import {
  type ContainerMode,
  vendContainer
} from '@device/infrastructure/house-arrest/client.ts'
import { createInstallationProxy } from '@device/infrastructure/installation-proxy/client.ts'
import type { InstallationProxy } from '@device/infrastructure/installation-proxy/types.ts'
import {
  createMisagent,
  type Misagent
} from '@device/infrastructure/misagent/client.ts'

const afcOptions = (ctx: DeviceContext): AfcClientOptions => ({
  logger: ctx.deps.logger,
  maxMessageBytes: ctx.deps.config.maxMessageBytes,
  writeChunkBytes: ctx.deps.config.afcWriteChunkBytes,
  readChunkBytes: ctx.deps.config.afcReadChunkBytes
})

const plistOptions = (ctx: DeviceContext) => ({
  limits: ctx.limits,
  logger: ctx.deps.logger
})

/** The media/staging file system (`/var/mobile/Media`). */
export const openAfc = async (
  ctx: DeviceContext,
  session: DeviceSession
): Promise<AfcClient> =>
  createAfcClient(await session.startService(Service.Afc), afcOptions(ctx))

/** An app's container or Documents folder, as an AFC file system. */
export const openAppContainer = async (
  ctx: DeviceContext,
  session: DeviceSession,
  bundleId: string,
  mode: ContainerMode = 'container'
): Promise<AfcClient> =>
  closeOnError(await session.startService(Service.HouseArrest), (link) =>
    vendContainer(link, bundleId, mode, {
      ...plistOptions(ctx),
      afc: afcOptions(ctx)
    })
  )

export const openInstallationProxy = async (
  ctx: DeviceContext,
  session: DeviceSession
): Promise<InstallationProxy> =>
  createInstallationProxy(
    await session.startService(Service.InstallationProxy),
    plistOptions(ctx)
  )

export const openMisagent = async (
  ctx: DeviceContext,
  session: DeviceSession
): Promise<Misagent> =>
  createMisagent(
    await session.startService(Service.Misagent),
    plistOptions(ctx)
  )

/** Runs `use` with an installation_proxy client and always closes it. */
export const useInstallationProxy = async <T>(
  ctx: DeviceContext,
  session: DeviceSession,
  use: (proxy: InstallationProxy) => Promise<T>
): Promise<T> => withClient(await openInstallationProxy(ctx, session), use)

/** Runs `use` with a misagent client and always closes it. */
export const useMisagent = async <T>(
  ctx: DeviceContext,
  session: DeviceSession,
  use: (misagent: Misagent) => Promise<T>
): Promise<T> => withClient(await openMisagent(ctx, session), use)

export const revealDeveloperMode = async (
  ctx: DeviceContext,
  session: DeviceSession
): Promise<void> =>
  withClient(await session.startService(Service.Amfi), (link) =>
    revealDeveloperModeOption(link, plistOptions(ctx))
  )

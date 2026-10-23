// The one place connections to the device are opened. A port is reached through usbmuxd, or straight at its Wi-Fi
// address when it was found on the network; everything above (lockdown, its TLS, every service) is the same.
// A service is started by lockdown (`StartService`, then a connection to its port) or, on iOS 17.4 and later,
// reached through the device's tunnel, where each lockdown service has a counterpart that needs no TLS.
import type { DeviceContext } from '@device/application/context.ts'
import { openDeviceTunnel } from '@device/application/tunnel.ts'
import type {
  DeviceTunnel,
  ServiceRouter,
  StartServiceOptions
} from '@device/application/types.ts'
import { shortUdid } from '@device/domain/device.ts'
import { tlsCredentials } from '@device/domain/pairing/pair-record.ts'
import type { PairRecord } from '@device/domain/pairing/types.ts'
import type { UsbmuxDevice } from '@device/domain/types.ts'
import { closeOnError } from '@device/infrastructure/closeable.ts'
import { createLink, type Link } from '@device/infrastructure/framing/link.ts'
import type { LockdownClient } from '@device/infrastructure/lockdown/types.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export const connectToDevice = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  port: number
): Promise<Link> => {
  if (device.address === undefined)
    return ctx.usbmux.connect(device.deviceId, port)
  const { connectTcp } = ctx.deps.transport
  if (!connectTcp)
    throw new IPAForgeError(ErrorCode.DeviceNotFound, {
      message: 'this host cannot connect to devices on the network',
      data: { device: shortUdid(device.udid) }
    })
  ctx.deps.logger.debug('connecting over Wi-Fi', {
    device: shortUdid(device.udid),
    port
  })

  return createLink(await connectTcp(device.address, port))
}

const isServiceUnavailable = (error: unknown): boolean =>
  error instanceof IPAForgeError && error.code === ErrorCode.ServiceUnavailable

/**
 * How one session starts services. `tunnel`: through the device's tunnel whenever the service has a counterpart
 * there, else by lockdown. `fallback`: by lockdown, and through the tunnel only when lockdown answers that the
 * service isn't available. The tunnel opens on first use and closes with the router.
 */
export const createServiceRouter = (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  session: {
    readonly lockdown: LockdownClient
    readonly pairRecord: PairRecord
  },
  mode: 'tunnel' | 'fallback'
): ServiceRouter => {
  const { logger } = ctx.deps
  const { lockdown, pairRecord } = session
  const credentials = tlsCredentials(pairRecord)
  let tunnel: Promise<DeviceTunnel> | undefined

  const startLockdownService = async (
    service: string,
    escrowBag?: Uint8Array
  ): Promise<Link> => {
    const { port, enableServiceSsl } = await lockdown.startService(
      service,
      escrowBag
    )

    return closeOnError(
      await connectToDevice(ctx, device, port),
      async (link) => {
        if (enableServiceSsl) await link.startTls(credentials)
        return link
      }
    )
  }

  const openTunnel = (): Promise<DeviceTunnel> => {
    tunnel ??= openDeviceTunnel(ctx, device, (service) =>
      startLockdownService(service)
    )
    return tunnel
  }

  /** Lockdown said no: the tunnel's counterpart if there is one, else the original refusal. */
  const fallBack = async (service: string, refusal: unknown): Promise<Link> => {
    const link = await openTunnel()
      .then((opened) => opened.openShim(service))
      .catch((error: unknown) => {
        logger.debug('no tunnel to fall back on', { service, cause: error })
        return undefined
      })
    if (!link) throw refusal
    logger.info('lockdown refused a service; using the tunnel', {
      device: shortUdid(device.udid),
      service
    })
    return link
  }

  const startService = async (
    service: string,
    options: StartServiceOptions = {}
  ): Promise<Link> => {
    const escrowBag = options.escrowBag ? pairRecord.escrowBag : undefined
    if (mode === 'tunnel') {
      const link = await (await openTunnel()).openShim(service)

      return link ?? startLockdownService(service, escrowBag)
    }
    try {
      return await startLockdownService(service, escrowBag)
    } catch (error) {
      if (!isServiceUnavailable(error)) throw error
      return fallBack(service, error)
    }
  }

  return {
    startService,
    tunnel: openTunnel,
    close: async () => {
      const opened = await tunnel?.catch(() => undefined)
      await opened?.close()
    }
  }
}

// Opening the iOS 17.4+ device tunnel: over a session's link (CoreDeviceProxy) or over Wi-Fi (the remote pairing
// listener's TLS-PSK, wifi-tunnel.ts), then the CDTunnel handshake, our own TCP over its packets, and RSD for the
// service map. Addresses, ports and the MTU are fresh for every tunnel.
import type { DeviceContext } from '@device/application/context.ts'
import type { DeviceTunnel } from '@device/application/types.ts'
import { CORE_DEVICE_PROXY_SERVICE } from '@device/domain/constants.ts'
import { shortUdid } from '@device/domain/device.ts'
import type { UsbmuxDevice } from '@device/domain/types.ts'
import { closeOnError, withClient } from '@device/infrastructure/closeable.ts'
import { createLink, type Link } from '@device/infrastructure/framing/link.ts'
import { rsdCheckin } from '@device/infrastructure/rsd/checkin.ts'
import { SHIM_SUFFIX } from '@device/infrastructure/rsd/constants.ts'
import { rsdHandshake } from '@device/infrastructure/rsd/rsd.ts'
import type { RsdHandshake } from '@device/infrastructure/rsd/types.ts'
import { cdTunnelHandshake } from '@device/infrastructure/tunnel/cdtunnel.ts'
import { parseIpv6Address } from '@device/infrastructure/tunnel/ipv6.ts'
import { createTcpStack } from '@device/infrastructure/tunnel/tcp-stack.ts'
import type {
  TcpConfig,
  TcpStack
} from '@device/infrastructure/tunnel/types.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const tcpConfig = (ctx: DeviceContext, tunnelMtu: number): TcpConfig => {
  const { config } = ctx.deps

  return {
    mtu: Math.min(config.tunnelMtu, tunnelMtu),
    initialRtoMs: config.tunnelInitialRtoMs,
    maxRtoMs: config.tunnelMaxRtoMs,
    maxRetransmits: config.tunnelMaxRetransmits,
    sendBufferBytes: config.tunnelSendBufferBytes,
    receiveBufferBytes: config.tunnelReceiveBufferBytes
  }
}

const isServiceUnavailable = (error: unknown): boolean =>
  error instanceof IPAForgeError && error.code === ErrorCode.ServiceUnavailable

/** Starts CoreDeviceProxy; a device that doesn't know it has no tunnel (before iOS 17.4). */
const startProxy = async (
  device: UsbmuxDevice,
  startService: (service: string) => Promise<Link>
): Promise<Link> => {
  try {
    return await startService(CORE_DEVICE_PROXY_SERVICE)
  } catch (error) {
    if (!isServiceUnavailable(error)) throw error
    throw new IPAForgeError(ErrorCode.TunnelUnavailable, {
      message: 'the device has no tunnel service (iOS 17.4 or later is needed)',
      cause: error,
      data: { device: shortUdid(device.udid) }
    })
  }
}

/** Asks RSD for the service map on a connection of its own, closed after. */
const discoverServices = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  stack: TcpStack,
  rsdPort: number
): Promise<RsdHandshake> => {
  const handshake = await withClient(
    createLink(await stack.connect(rsdPort)),
    (link) =>
      rsdHandshake(link, {
        maxMessageBytes: ctx.deps.config.maxMessageBytes,
        timeoutMs: ctx.deps.config.rsdHandshakeTimeoutMs
      })
  )
  // Defence in depth: the tunnel came over this device's own session, so it must answer for this device.
  const udid = handshake.properties.UniqueDeviceID
  if (typeof udid === 'string' && udid !== device.udid)
    throw new IPAForgeError(ErrorCode.DeviceProtocolError, {
      message: 'the tunnel answered for another device',
      data: { device: shortUdid(device.udid) }
    })
  return handshake
}

/**
 * Opens the tunnel through `startService` (the session's lockdown `StartService`, so the proxy connection gets the
 * session's TLS). Throws `device.tunnel_unavailable` before iOS 17.4.
 */
export const openDeviceTunnel = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  startService: (service: string) => Promise<Link>
): Promise<DeviceTunnel> =>
  openTunnelOver(ctx, device, await startProxy(device, startService))

/**
 * The tunnel over a connection that carries it (CoreDeviceProxy's over USB, the remote pairing listener's TLS over
 * Wi-Fi): the CDTunnel handshake, our own TCP over its packets, then RSD. `onClose` closes what the carrier
 * depends on (the remote pairing control connection over Wi-Fi), after the tunnel.
 */
export const openTunnelOver = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  proxy: Link,
  onClose: () => Promise<void> = async () => {}
): Promise<DeviceTunnel> => {
  const { logger, config } = ctx.deps
  const started = ctx.deps.clock.now().getTime()
  const parameters = await closeOnError(proxy, (link) =>
    cdTunnelHandshake(link, config.tunnelMtu)
  )
  const tcp = tcpConfig(ctx, parameters.mtu)
  const stack = await closeOnError(proxy, async (link) =>
    createTcpStack(
      link,
      {
        local: parseIpv6Address(parameters.clientAddress),
        remote: parseIpv6Address(parameters.serverAddress)
      },
      tcp,
      logger
    )
  )
  const { services, properties } = await closeOnError(stack, () =>
    discoverServices(ctx, device, stack, parameters.rsdPort)
  )
  logger.info('tunnel opened', {
    device: shortUdid(device.udid),
    mtu: tcp.mtu,
    services: services.size,
    ms: ctx.deps.clock.now().getTime() - started
  })

  return {
    mtu: tcp.mtu,
    services,
    properties,
    openShim: async (service) => {
      const shim = services.get(`${service}${SHIM_SUFFIX}`)
      if (!shim) return undefined
      const link = createLink(await stack.connect(shim.port))

      return closeOnError(link, async (checkedIn) => {
        await rsdCheckin(checkedIn, {
          label: config.label,
          limits: ctx.limits,
          service: shim.name
        })
        logger.debug('service through the tunnel', { service })
        return checkedIn
      })
    },
    stats: () => ({ ...stack.stats }),
    close: async () => {
      await stack.close()
      await onClose()
      logger.debug('tunnel closed', { device: shortUdid(device.udid) })
    }
  }
}

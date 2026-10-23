// Test-only: the device's CoreDeviceProxy end. It answers the CDTunnel handshake, then runs the fake TCP peer with
// RSD on its port and every shim behind an RSDCheckin, each handing over to the service's usual fake.
import {
  type FakeRsdRecord,
  serveFakeRsd
} from '@device/__tests__/fake-tunnel/fake-rsd.ts'
import {
  type FakeTcpPeer,
  type FakeTcpPeerOptions,
  type ServiceHandler,
  serveFakeTcpPeer
} from '@device/__tests__/fake-tunnel/fake-tcp-peer.ts'
import { DEFAULT_DEVICE_CONFIG } from '@device/domain/config.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  receivePlist,
  sendPlist
} from '@device/infrastructure/framing/plist-frames.ts'
import { SHIM_SUFFIX } from '@device/infrastructure/rsd/constants.ts'
import type { XpcDictionary } from '@device/infrastructure/rsd/types.ts'
import {
  encodeCdTunnelMessage,
  readCdTunnelMessage
} from '@device/infrastructure/tunnel/cdtunnel.ts'
import { parseIpv6Address } from '@device/infrastructure/tunnel/ipv6.ts'
import { createDict } from '@ipaforge/kernel'

export const TUNNEL_CLIENT_ADDRESS = '2001:db8:8961::2'
export const TUNNEL_SERVER_ADDRESS = '2001:db8:8961::1'
export const TUNNEL_RSD_PORT = 58_783
const FIRST_SHIM_PORT = 50_000
const DEVICE_MAX_MTU = 16_000

const LIMITS = {
  maxMessageBytes: DEFAULT_DEVICE_CONFIG.maxMessageBytes,
  plist: DEFAULT_DEVICE_CONFIG.plist
}

export type FakeTunnelOptions = {
  /** Lockdown service name → what serves it once checked in (its shim is `<name>.shim.remote`). */
  readonly shims: ReadonlyMap<string, ServiceHandler>
  /** Extra RSD entries that aren't shims (RemoteXPC services), by name. */
  readonly xpcServices?: readonly string[]
  readonly properties?: XpcDictionary
  readonly peer?: FakeTcpPeerOptions
  /** A shim whose check-in is refused with this error. */
  readonly refuseCheckin?: string
}

export type FakeTunnel = {
  /** The client's handshake request. */
  request?: unknown
  readonly rsd: FakeRsdRecord
  peer?: FakeTcpPeer
  /** Each check-in, as `<shim name>`. */
  readonly checkins: string[]
  /** Resolves once the client closed the proxy connection. */
  readonly closed: Promise<void>
}

const serveShim =
  (
    name: string,
    handler: ServiceHandler,
    tunnel: FakeTunnel,
    refuse?: string
  ) =>
  async (link: Link): Promise<void> => {
    const message = await receivePlist(link, LIMITS).catch(() => undefined)
    if (message?.Request !== 'RSDCheckin') return
    tunnel.checkins.push(name)
    if (refuse) {
      await sendPlist(link, createDict([['Error', refuse]]))
      return
    }
    await sendPlist(link, createDict([['Request', 'RSDCheckin']]))
    await sendPlist(link, createDict([['Request', 'StartService']]))
    await handler(link)
  }

/** RSD's service map and the TCP listeners behind it. */
const serviceTable = (options: FakeTunnelOptions, tunnel: FakeTunnel) => {
  const listeners = new Map<number, ServiceHandler>()
  const services: Record<string, XpcDictionary> = {}
  let port = FIRST_SHIM_PORT
  for (const [service, handler] of options.shims) {
    const name = `${service}${SHIM_SUFFIX}`
    const refuse =
      options.refuseCheckin === name ? 'ServiceProhibited' : undefined
    listeners.set(port, serveShim(name, handler, tunnel, refuse))
    // RSD sends ports as strings.
    services[name] = {
      Port: String(port),
      Properties: { UsesRemoteXPC: false }
    }
    port++
  }
  for (const name of options.xpcServices ?? [])
    services[name] = {
      Port: String(port++),
      Entitlement: 'com.apple.private.example',
      Properties: { UsesRemoteXPC: true }
    }

  return { listeners, services }
}

/** Serves CoreDeviceProxy on `link` (a lockdown service connection). */
export const serveFakeTunnel = (
  link: Link,
  options: FakeTunnelOptions
): FakeTunnel => {
  let markClosed: () => void = () => {}
  const tunnel: FakeTunnel = {
    rsd: { preface: '', frames: [], messages: new Map() },
    checkins: [],
    closed: new Promise((resolve) => {
      markClosed = resolve
    })
  }
  const { listeners, services } = serviceTable(options, tunnel)
  listeners.set(TUNNEL_RSD_PORT, (rsdLink) =>
    serveFakeRsd(
      rsdLink,
      {
        services,
        ...(options.properties ? { properties: options.properties } : {})
      },
      tunnel.rsd
    )
  )

  const run = async () => {
    const request = (await readCdTunnelMessage(link)) as { mtu?: number }
    tunnel.request = request
    await link.write(
      encodeCdTunnelMessage({
        clientParameters: {
          address: TUNNEL_CLIENT_ADDRESS,
          mtu: Math.min(request.mtu ?? DEVICE_MAX_MTU, DEVICE_MAX_MTU)
        },
        serverAddress: TUNNEL_SERVER_ADDRESS,
        serverRSDPort: TUNNEL_RSD_PORT,
        type: 'serverHandshakeResponse'
      })
    )
    tunnel.peer = serveFakeTcpPeer(
      link,
      {
        local: parseIpv6Address(TUNNEL_SERVER_ADDRESS),
        remote: parseIpv6Address(TUNNEL_CLIENT_ADDRESS)
      },
      listeners,
      options.peer
    )
    await tunnel.peer.ended
  }
  void run()
    .catch(() => undefined)
    .then(markClosed)

  return tunnel
}

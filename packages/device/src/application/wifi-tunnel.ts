// The iOS 17.4+ tunnel over Wi-Fi, with the remote pairing made over USB (11.1): TCP to the device's remote pairing
// port (`_remotepairing._tcp`), pair-verify, an encrypted `createListener` for a TCP tunnel, IPAForge's own TLS 1.2
// PSK to the port it gives (keyed with the pair-verify secret). Over that, the same tunnel as over USB: the CDTunnel
// handshake, our TCP client, RSD and the services. The steps were checked against iPhones on iOS 18.2 and 26.6.1.
import { z } from 'zod'

import type { DeviceContext } from '@device/application/context.ts'
import { hostNameOf, savedRecord } from '@device/application/remote-pairing.ts'
import { openTunnelOver } from '@device/application/tunnel.ts'
import type { DeviceTunnel } from '@device/application/types.ts'
import { shortUdid } from '@device/domain/device.ts'
import type { Connection } from '@device/domain/ports/types.ts'
import type { UsbmuxDevice } from '@device/domain/types.ts'
import { closeOnError } from '@device/infrastructure/closeable.ts'
import { createLink } from '@device/infrastructure/framing/link.ts'
import { browseService } from '@device/infrastructure/mdns/browser.ts'
import { REMOTE_PAIRING_SERVICE } from '@device/infrastructure/mdns/constants.ts'
import { createPairingChannel } from '@device/infrastructure/remote-pairing/channel.ts'
import { createEncryptedChannel } from '@device/infrastructure/remote-pairing/encrypted-channel.ts'
import { pairVerify } from '@device/infrastructure/remote-pairing/pair-verify.ts'
import { connectTlsPsk } from '@device/infrastructure/tls-psk/connection.ts'
import { ErrorCode, IPAForgeError, toBase64 } from '@ipaforge/kernel'

const listenerSchema = z.object({
  response: z.object({
    _1: z.object({
      createListener: z.object({ port: z.number().int().positive() })
    })
  })
})

const randomBytes = (length: number): Uint8Array =>
  globalThis.crypto.getRandomValues(new Uint8Array(length))

const unreachable = (udid: string, message: string) =>
  new IPAForgeError(ErrorCode.DeviceNotFound, {
    message,
    data: { device: shortUdid(udid) }
  })

/** The port the device's remote pairing listens on, from its advert at `address`. */
const remotePairingPort = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  address: string
): Promise<number> => {
  const { transport, sleep, clock, logger, config } = ctx.deps
  if (!transport.openMulticast)
    throw unreachable(device.udid, 'this host cannot search the network')
  const socket = await transport.openMulticast()
  const controller = new AbortController()
  let port: number | undefined
  try {
    const search = browseService(
      socket,
      REMOTE_PAIRING_SERVICE,
      {
        sleep,
        now: () => clock.now().getTime(),
        intervalMs: config.networkBrowseMs,
        logger
      },
      (event) => {
        if (event.kind !== 'found' || event.advert.address !== address) return
        port = event.advert.port
        controller.abort()
      },
      controller.signal
    )
    await Promise.race([
      search,
      sleep(config.networkBrowseMs).then(() => controller.abort())
    ])
    await search
  } finally {
    await socket.close()
  }
  if (port === undefined)
    throw unreachable(
      device.udid,
      'its remote pairing was not found on the network'
    )
  return port
}

const connectTo = (
  ctx: DeviceContext,
  address: string,
  port: number
): Promise<Connection> => {
  const { connectTcp } = ctx.deps.transport
  if (!connectTcp)
    throw new IPAForgeError(ErrorCode.DeviceNotFound, {
      message: 'this host cannot connect to devices on the network'
    })
  return connectTcp(address, port)
}

const createListenerRequest = (secret: Uint8Array) => ({
  request: {
    _0: {
      createListener: {
        key: toBase64(secret),
        peerConnectionsInfo: [
          { owningPID: 0, owningProcessName: 'CoreDeviceService' }
        ],
        transportProtocolType: 'tcp'
      }
    }
  }
})

/** Opens the tunnel to a device on Wi-Fi with its saved remote pairing; close it when done. */
export const openWifiTunnel = async (
  ctx: DeviceContext,
  device: UsbmuxDevice
): Promise<DeviceTunnel> => {
  const { address } = device
  if (address === undefined)
    throw unreachable(device.udid, 'the device is not on Wi-Fi')
  const record = await savedRecord(ctx, device.udid)
  if (!record)
    throw new IPAForgeError(ErrorCode.DeviceNotPaired, {
      message: 'no remote pairing yet: make one over USB first',
      data: { device: shortUdid(device.udid) }
    })
  const port = await remotePairingPort(ctx, device, address)
  // The control connection stays open for the tunnel's life: the device ends the tunnel when it closes.
  const control = createLink(await connectTo(ctx, address, port))

  return closeOnError(control, async () => {
    const channel = createPairingChannel(control)
    const secret = await pairVerify(channel, {
      record,
      hostName: hostNameOf(record.identifier),
      randomBytes
    })
    const reply = await createEncryptedChannel(channel, secret).request(
      createListenerRequest(secret)
    )
    const listener = listenerSchema.safeParse(reply)
    if (!listener.success)
      throw new IPAForgeError(ErrorCode.DeviceProtocolError, {
        message: 'remote pairing: the device did not open a tunnel listener'
      })
    const raw = await connectTo(
      ctx,
      address,
      listener.data.response._1.createListener.port
    )
    const link = createLink(
      await closeOnError(raw, (connection) =>
        connectTlsPsk(connection, { psk: secret, randomBytes })
      )
    )
    ctx.deps.logger.info('tunnel carrier open over Wi-Fi', {
      device: shortUdid(device.udid)
    })

    return openTunnelOver(ctx, device, link, () => control.close())
  })
}

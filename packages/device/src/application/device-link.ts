// The one place a connection to a port on the device is opened: through usbmuxd, or straight to its Wi-Fi
// address when it was found on the network. Everything above (lockdown, its TLS, every service) is the same.
import type { DeviceContext } from '@device/application/context.ts'
import { shortUdid } from '@device/domain/device.ts'
import type { UsbmuxDevice } from '@device/domain/types.ts'
import { createLink, type Link } from '@device/infrastructure/framing/link.ts'
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

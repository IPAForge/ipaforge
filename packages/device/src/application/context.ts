import type { FrameLimits } from '@device/infrastructure/framing/plist-frames.ts'
import { createUsbmuxClient } from '@device/infrastructure/usbmux/client.ts'
import type { UsbmuxClient } from '@device/infrastructure/usbmux/types.ts'
import type { DeviceDeps } from '@device/types.ts'

/** Shared state for every device operation. */
export type DeviceContext = {
  readonly deps: DeviceDeps
  readonly usbmux: UsbmuxClient
  readonly limits: FrameLimits
}

export const createDeviceContext = (deps: DeviceDeps): DeviceContext => {
  const limits: FrameLimits = {
    maxMessageBytes: deps.config.maxMessageBytes,
    plist: deps.config.plist
  }

  return {
    deps,
    limits,
    usbmux: createUsbmuxClient({
      transport: deps.transport,
      logger: deps.logger,
      label: deps.config.label,
      limits
    })
  }
}

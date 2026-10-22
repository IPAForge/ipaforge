import type { UsbmuxDevice } from '@device/domain/types.ts'
import type { FrameLimits } from '@device/infrastructure/framing/plist-frames.ts'
import { createUsbmuxClient } from '@device/infrastructure/usbmux/client.ts'
import type { UsbmuxClient } from '@device/infrastructure/usbmux/types.ts'
import type { DeviceDeps } from '@device/types.ts'

/** Shared state for every device operation. */
export type DeviceContext = {
  readonly deps: DeviceDeps
  readonly usbmux: UsbmuxClient
  readonly limits: FrameLimits
  /** Devices found on the network while a search runs, by UDID: reached straight at their Wi-Fi address. */
  readonly network: Map<string, UsbmuxDevice>
  /** Each network device's negative device id, kept so it stays the same while the manager lives. */
  readonly networkIds: Map<string, number>
}

export const createDeviceContext = (deps: DeviceDeps): DeviceContext => {
  const limits: FrameLimits = {
    maxMessageBytes: deps.config.maxMessageBytes,
    plist: deps.config.plist
  }

  return {
    deps,
    limits,
    network: new Map(),
    networkIds: new Map(),
    usbmux: createUsbmuxClient({
      transport: deps.transport,
      logger: deps.logger,
      label: deps.config.label,
      limits
    })
  }
}

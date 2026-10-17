import type { DeviceTransport } from '@device/domain/ports/types.ts'
import type { DeviceEvent, UsbmuxDevice } from '@device/domain/types.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import type { FrameLimits } from '@device/infrastructure/framing/plist-frames.ts'
import type { Logger } from '@loadstar/kernel'

export type UsbmuxClientOptions = {
  readonly transport: DeviceTransport
  readonly logger: Logger
  readonly label: string
  readonly limits: FrameLimits
}

export type UsbmuxClient = {
  listDevices(): Promise<UsbmuxDevice[]>
  /** Streams attach/detach events until `signal` aborts. The current devices arrive first as `attached`. */
  listen(
    onEvent: (event: DeviceEvent) => void,
    signal: AbortSignal
  ): Promise<void>
  /** Opens a raw stream to `port` on the device. */
  connect(deviceId: number, port: number): Promise<Link>
  readBuid(): Promise<string>
  /**
   * The raw pair record plist bytes, or `undefined` when usbmuxd has none for this device. Read only: the record
   * belongs to the OS, so this client never saves or deletes one.
   */
  readPairRecord(udid: string): Promise<Uint8Array | undefined>
}

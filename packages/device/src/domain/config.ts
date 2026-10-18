// Every tunable of the device layer, with the defaults the engine ships with. Callers override any subset.
import { DEFAULT_PLIST_LIMITS, type PlistLimits } from '@ipaforge/kernel'

export type DeviceConfig = {
  /** Name sent as `Label`/`ProgName` to usbmuxd and lockdownd. */
  readonly label: string
  /** Largest usbmux or plist-service message accepted from the device. */
  readonly maxMessageBytes: number
  readonly plist: PlistLimits
  /** How often to ask again while waiting for the user to tap Trust (usbmuxd for the OS record, or `Pair`). */
  readonly pairingPollIntervalMs: number
  /** How long to wait for the OS to create its pair record (the user taps Trust) before pairing on our own. */
  readonly osPairingTimeoutMs: number
  /** How long our own `Pair` waits for the user to tap Trust. */
  readonly pairingTimeoutMs: number
  /** Bytes per AFC write packet. */
  readonly afcWriteChunkBytes: number
  /** Bytes requested per AFC read packet. */
  readonly afcReadChunkBytes: number
}

export const DEFAULT_DEVICE_CONFIG: DeviceConfig = {
  label: 'ipaforge',
  maxMessageBytes: 64 * 1024 * 1024,
  plist: DEFAULT_PLIST_LIMITS,
  pairingPollIntervalMs: 1000,
  osPairingTimeoutMs: 60_000,
  pairingTimeoutMs: 120_000,
  afcWriteChunkBytes: 64 * 1024,
  afcReadChunkBytes: 1024 * 1024
}

export const resolveDeviceConfig = (
  overrides: Partial<DeviceConfig> = {}
): DeviceConfig => ({
  ...DEFAULT_DEVICE_CONFIG,
  ...overrides
})

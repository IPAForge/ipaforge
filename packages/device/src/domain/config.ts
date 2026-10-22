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
  /** Turn on the device's Wi-Fi connections whenever a session opens, so it can be reached without the cable. */
  readonly enableWifiConnections: boolean
  /** How long a search for devices on the network listens for answers. */
  readonly networkBrowseMs: number
  /** How often a running search asks again; a device not heard from for three rounds is gone. */
  readonly networkQueryIntervalMs: number
  /**
   * The largest packet IPAForge sends through the iOS 17.4+ tunnel (asked for in the handshake, and a cap on every
   * packet). Packets of 8 KB and more stall connections to the device.
   */
  readonly tunnelMtu: number
  /** First retransmission timeout inside the tunnel, doubled on every timeout up to `tunnelMaxRtoMs`. */
  readonly tunnelInitialRtoMs: number
  readonly tunnelMaxRtoMs: number
  /** Retransmission timeouts in a row before a connection inside the tunnel is given up. */
  readonly tunnelMaxRetransmits: number
  /** Unacknowledged bytes each connection inside the tunnel may queue before a write waits. */
  readonly tunnelSendBufferBytes: number
  /** Bytes each connection inside the tunnel buffers before it closes its receive window. */
  readonly tunnelReceiveBufferBytes: number
  /** How long the device's service discovery (RSD) may take to answer inside the tunnel. */
  readonly rsdHandshakeTimeoutMs: number
}

export const DEFAULT_DEVICE_CONFIG: DeviceConfig = {
  label: 'ipaforge',
  maxMessageBytes: 64 * 1024 * 1024,
  plist: DEFAULT_PLIST_LIMITS,
  pairingPollIntervalMs: 1000,
  osPairingTimeoutMs: 60_000,
  pairingTimeoutMs: 120_000,
  // Measured on an iPhone over Wi-Fi (device-probe afc-speed): 64 KiB 2.7 MiB/s, 256 KiB 4.7, 1 MiB 6.4, 4 MiB 6.7.
  afcWriteChunkBytes: 1024 * 1024,
  afcReadChunkBytes: 1024 * 1024,
  enableWifiConnections: true,
  networkBrowseMs: 3000,
  networkQueryIntervalMs: 10_000,
  // Measured over USB (iOS 26, 100 MiB to PublicStaging): MTU 1500 29.8 MiB/s, 6000 33.7, 8000 34.2.
  tunnelMtu: 8000,
  tunnelInitialRtoMs: 200,
  tunnelMaxRtoMs: 8000,
  tunnelMaxRetransmits: 8,
  tunnelSendBufferBytes: 4 * 1024 * 1024,
  tunnelReceiveBufferBytes: 4 * 1024 * 1024,
  rsdHandshakeTimeoutMs: 10_000
}

export const resolveDeviceConfig = (
  overrides: Partial<DeviceConfig> = {}
): DeviceConfig => ({
  ...DEFAULT_DEVICE_CONFIG,
  ...overrides
})

// Installer tunables, with the defaults the app ships with.

const DAY_MS = 24 * 60 * 60 * 1000

export type InstallerConfig = {
  /** Apps signed by a free team that iOS lets run on one device at a time (expired ones included). */
  readonly freeAppLimit: number
  /**
   * Free-team profiles last 7 days, paid ones a year. A profile whose lifetime is at most this long counts as a
   * free one when its team is not one of the account's own teams.
   */
  readonly freeProfileMaxLifetimeMs: number
  /** Name Apple shows for certificates IPAForge creates (the revoke picker tells tools apart by it). */
  readonly machineName: string
  /** Wrong second-factor codes accepted before the sign-in step gives up. */
  readonly twoFactorAttempts: number
  /** First wait before reconnecting to usbmuxd after the device watch dropped; doubles on each failure. */
  readonly deviceReconnectBaseMs: number
  /** Longest wait between reconnect attempts. */
  readonly deviceReconnectMaxMs: number
  /** How often the device list is read when usbmuxd refuses `Listen` (the fallback; normally devices are pushed). */
  readonly devicePollIntervalMs: number
}

export const DEFAULT_INSTALLER_CONFIG: InstallerConfig = {
  freeAppLimit: 3,
  freeProfileMaxLifetimeMs: 8 * DAY_MS,
  machineName: 'IPAForge',
  twoFactorAttempts: 5,
  deviceReconnectBaseMs: 1000,
  deviceReconnectMaxMs: 30_000,
  devicePollIntervalMs: 30_000
}

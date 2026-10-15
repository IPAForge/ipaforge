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
  /** Name Apple shows for certificates Loadstar creates (the revoke picker tells tools apart by it). */
  readonly machineName: string
  /** Wrong second-factor codes accepted before the sign-in step gives up. */
  readonly twoFactorAttempts: number
}

export const DEFAULT_INSTALLER_CONFIG: InstallerConfig = {
  freeAppLimit: 3,
  freeProfileMaxLifetimeMs: 8 * DAY_MS,
  machineName: 'Loadstar',
  twoFactorAttempts: 5
}

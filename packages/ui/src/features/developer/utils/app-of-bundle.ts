import type { InstalledApp } from '@ui/services/engine/types.ts'

/**
 * The installed app a bundle id belongs to: the app itself, or the app whose extension it is
 * (`com.example.app.TEAM.Widget` belongs to `com.example.app.TEAM`); undefined when none is installed.
 */
export const appOfBundle = (
  bundleId: string | undefined,
  apps: readonly InstalledApp[]
): InstalledApp | undefined =>
  bundleId === undefined
    ? undefined
    : apps.find(
        (app) =>
          bundleId === app.bundleId || bundleId.startsWith(`${app.bundleId}.`)
      )

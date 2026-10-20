import type { InstalledApp } from '@ui/services/engine/types.ts'

/** The installed apps whose IPAForge mark says this certificate signed them. */
export const appsSignedBy = (
  serialNumber: string,
  apps: readonly InstalledApp[]
): InstalledApp[] =>
  apps.filter(
    (app) =>
      app.marker?.certificateSerial?.toUpperCase() ===
      serialNumber.toUpperCase()
  )

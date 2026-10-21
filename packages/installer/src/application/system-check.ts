// What the setup guide checks on this computer before anything else: that the system service talking to iPhones
// (usbmuxd, Apple Devices on Windows) answers, that Apple's servers can be reached, that the clock is right (Apple
// refuses sign-in when it's far off), and which anisette server sign-in would use (the first, in order, that answers).
import type { SystemCheck } from '@installer/engine/types.ts'
import type { InstallerDeps } from '@installer/types.ts'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const isServiceMissing = (error: unknown): boolean =>
  error instanceof IPAForgeError && error.code === ErrorCode.UsbmuxdUnavailable

export const systemCheck = async (
  deps: InstallerDeps
): Promise<SystemCheck> => {
  const [deviceService, preflight] = await Promise.all([
    deps.devices.listDevices().then(
      () => 'ok' as const,
      (error: unknown) => {
        if (isServiceMissing(error)) return 'missing' as const
        deps.logger.warn('device service check failed', { cause: error })
        return 'failed' as const
      }
    ),
    deps.apple.preflight()
  ])

  return compact({
    deviceService,
    apple: preflight.apple.ok,
    clockOk: preflight.clockOk,
    clockSkewSeconds: preflight.clockSkewSeconds,
    anisette: compact({
      server: preflight.anisette.find((server) => server.ok)?.server.name,
      tried: preflight.anisette.length
    })
  })
}

// Remove: deletes the app from the device and forgets it, with its kept IPA. It frees a free-app slot.
import { forgetRecords } from '@installer/application/installed/records.ts'
import type { InstallerDeps } from '@installer/types.ts'

export const removeInstalledApp = async (
  deps: InstallerDeps,
  udid: string,
  bundleId: string
): Promise<void> => {
  const handle = await deps.devices.open(udid, { autoPair: false })

  try {
    await handle.uninstall(bundleId)
  } finally {
    await handle.close()
  }
  await forgetRecords(deps, udid, new Set([bundleId]))
  deps.logger.info('app removed', { bundleId })
}

import type { AccountState } from '@ui/features/accounts/types.ts'
import type { InstallDeviceState } from '@ui/features/install/home/types.ts'
import {
  installReadiness,
  type Readiness
} from '@ui/features/install/home/utils/readiness.ts'
import type {
  PreloadRow,
  PreloadTotals
} from '@ui/features/preload/home/types.ts'

const notReady = (reasonKey: Readiness['reasonKey']): Readiness => ({
  isReady: false,
  reasonKey
})

/**
 * Whether Install can be pressed, and if not the one thing to do first: another run going, the device and the
 * Apple ID (as on the Install page), an empty list, apps still being read, apps that can't be installed, then the
 * App IDs left this week.
 */
export const preloadReadiness = (
  isOtherRunActive: boolean,
  device: InstallDeviceState | undefined,
  account: AccountState | undefined,
  rows: readonly PreloadRow[],
  totals: PreloadTotals
): Readiness => {
  if (isOtherRunActive) return notReady('preload.readiness.busy')
  const basics = installReadiness(device, account, true)
  if (!basics.isReady) return basics
  if (rows.length === 0) return notReady('preload.readiness.empty')
  if (rows.some((row) => row.status !== 'ready' && row.status !== 'problem'))
    return notReady('preload.readiness.checking')
  if (rows.some((row) => row.status === 'problem'))
    return notReady('preload.readiness.problems')
  if (!totals.enough) return notReady('install.readiness.appIds')
  return { isReady: true, reasonKey: 'install.readiness.ready' }
}

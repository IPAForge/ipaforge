// Whether an install can start, and if not, the one thing to do first: the device (an Apple TV or Vision Pro can't be
// installed to yet), then the Apple ID, then the App IDs left this week. An Apple ID that needs signing in again is fine: the run asks for the password.
import type { AccountState } from '@ui/features/accounts/types.ts'
import type { InstallDeviceState } from '@ui/features/install/home/types.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

export type Readiness = {
  readonly isReady: boolean
  readonly reasonKey: TranslationKey
}

const notReady = (reasonKey: TranslationKey): Readiness => ({
  isReady: false,
  reasonKey
})

export const installReadiness = (
  device: InstallDeviceState | undefined,
  account: AccountState | undefined,
  hasEnoughAppIds: boolean
): Readiness => {
  if (!device) return notReady('install.readiness.noDevice')
  if (device === 'later') return notReady('install.readiness.notYetTv')
  if (device === 'checking') return notReady('install.readiness.checking')
  if (device !== 'ready') return notReady('install.readiness.device')
  if (!account) return notReady('install.readiness.noAccount')
  if (account === 'blocked') return notReady('install.readiness.blocked')
  if (!hasEnoughAppIds) return notReady('install.readiness.appIds')
  return { isReady: true, reasonKey: 'install.readiness.ready' }
}

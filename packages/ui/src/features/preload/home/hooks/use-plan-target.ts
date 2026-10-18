import { useAccountView } from '@ui/features/accounts/hooks/use-account-view.ts'
import { useDeviceView } from '@ui/features/devices/hooks/use-device-view.ts'
import type { PlanTarget } from '@ui/features/preload/home/hooks/use-preload-rows.ts'
import {
  useActiveAccount,
  useDeviceInUse,
  useDevicesInUse
} from '@ui/hooks/use-selection.ts'

/**
 * The device and Apple ID in use, their states, and the target the apps are planned for once both are ready (as
 * on the Install page: an Apple ID still being checked is fine).
 */
export const usePlanTarget = () => {
  const inUse = useDeviceInUse()
  const account = useActiveAccount()
  const deviceView = useDeviceView(inUse?.udid, inUse?.device)
  const accountView = useAccountView(account, useDevicesInUse())
  const canPlan =
    inUse !== undefined &&
    account !== undefined &&
    deviceView.state === 'ready' &&
    (accountView.state === 'ready' || accountView.state === 'checking')
  const target: PlanTarget | undefined = canPlan
    ? { udid: inUse.udid, accountId: account.id }
    : undefined

  return {
    target,
    deviceState: deviceView.state,
    accountState: accountView.state
  }
}

import { skipToken, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import { useActiveAccount, useDeviceInUse } from '@ui/hooks/use-selection.ts'

/**
 * Repair SideStore's check of the device in use with the Apple ID in use: asked while the device is connected,
 * again on Check again, and when a run ends (its key is under the installed apps').
 */
export const useSideStoreCheck = () => {
  const engine = useEngine()
  const device = useDeviceInUse()
  const account = useActiveAccount()
  const udid = device?.isConnected ? device.udid : undefined

  return useQuery({
    queryKey: queryKeys.sideStoreCheck(udid, account?.id),
    queryFn:
      udid && account
        ? () => engine.checkSideStore({ udid, accountId: account.id })
        : skipToken,
    retry: false
  })
}

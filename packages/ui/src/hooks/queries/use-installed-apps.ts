import { skipToken, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/**
 * The apps on the device signed with one of the account's teams, soonest to expire first, read from the device.
 * Asked only while the device is connected; refreshed when a run ends and after Remove.
 */
export const useInstalledApps = (
  udid: string | undefined,
  teamIds: readonly string[],
  isConnected: boolean
) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.installedApps(udid, teamIds),
    queryFn:
      udid && isConnected && teamIds.length > 0
        ? () => engine.installedApps({ udid, teamIds })
        : skipToken
  })
}

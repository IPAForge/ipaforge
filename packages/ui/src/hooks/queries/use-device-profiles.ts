import { skipToken, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** The provisioning profiles on a connected device, each with whether an installed app uses it. */
export const useDeviceProfiles = (udid: string | undefined) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.deviceProfiles(udid),
    queryFn: udid ? () => engine.deviceProfiles(udid) : skipToken
  })
}

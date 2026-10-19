import { skipToken, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** What the checklist looks for among the device's apps (LocalDevVPN), asked while it can answer. */
export const useDeviceApps = (udid: string, canAsk: boolean) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.deviceApps(udid),
    queryFn: canAsk ? () => engine.deviceApps(udid) : skipToken,
    retry: false
  })
}

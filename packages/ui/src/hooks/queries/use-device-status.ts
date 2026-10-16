import { skipToken, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/**
 * Name, model, iOS, lock state and Developer Mode of a device; fails with `device.not_paired` and the like. Read
 * again when the device comes or goes (`useDeviceFeed`), never on a timer.
 */
export const useDeviceStatus = (udid: string | undefined) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.deviceStatus(udid),
    queryFn: udid ? () => engine.deviceStatus(udid) : skipToken
  })
}

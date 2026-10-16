import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { DeviceWatchEvent } from '@loadstar/rpc'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { uniqueDevices } from '@ui/hooks/queries/use-devices.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/**
 * Keeps the device queries in step with the Engine's device feed (usbmuxd `Listen`): every new list replaces the
 * cached one, and a device that comes or goes has its status read again. Mounted once, by `App`.
 */
export const useDeviceFeed = (): void => {
  const engine = useEngine()
  const queryClient = useQueryClient()

  useEffect(() => {
    const onEvent = (event: DeviceWatchEvent) => {
      if (event.type === 'devices') {
        queryClient.setQueryData(
          queryKeys.devices,
          uniqueDevices(event.devices)
        )
        return
      }
      const udid = event.type === 'attached' ? event.device.udid : event.udid
      if (udid)
        void queryClient.invalidateQueries({
          queryKey: queryKeys.deviceStatus(udid)
        })
    }

    return engine.watchDevices(onEvent)
  }, [engine, queryClient])
}

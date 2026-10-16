import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import type { Device } from '@ui/services/engine/engine-types.ts'

/** One entry per device: a device on both USB and Wi-Fi is listed once, with its USB link. */
export const uniqueDevices = (devices: readonly Device[]): Device[] => {
  const byUdid = new Map<string, Device>()
  for (const device of devices) {
    const known = byUdid.get(device.udid)
    if (!known || device.connectionType === 'usb')
      byUdid.set(device.udid, device)
  }
  return [...byUdid.values()]
}

/**
 * Connected devices. Read once; after that the device feed (`useDeviceFeed`) writes every change into the cache
 * as usbmuxd reports it, so the list never goes stale and is never polled.
 */
export const useDevices = () => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.devices,
    queryFn: async () => uniqueDevices(await engine.listDevices()),
    staleTime: Number.POSITIVE_INFINITY
  })
}

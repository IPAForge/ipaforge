import type { ListedDevice } from '@ui/hooks/queries/use-devices.ts'

/** How the device is connected, in words. */
export const linkKey = (device: ListedDevice | undefined) => {
  if (!device) return undefined
  if (device.connections.length > 1) return 'devices.link.both' as const
  return device.connectionType === 'usb'
    ? ('devices.link.usb' as const)
    : ('devices.link.network' as const)
}

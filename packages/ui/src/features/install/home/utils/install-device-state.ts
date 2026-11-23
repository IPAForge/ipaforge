import type { DeviceState } from '@ui/features/devices/types.ts'
import type { InstallDeviceState } from '@ui/features/install/home/types.ts'
import type { DeviceInUse } from '@ui/hooks/use-selection.ts'

/**
 * SideStore runs on iPhone and iPad only: an Apple TV or Vision Pro (paired by code) gets its apps from Preload
 * instead.
 */
export const installDeviceState = (
  inUse: DeviceInUse | undefined,
  state: DeviceState | undefined
): InstallDeviceState | undefined =>
  inUse?.device?.pairedByCode ? 'noSideStore' : state

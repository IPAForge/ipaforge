import type { DeviceState } from '@ui/features/devices/types.ts'
import type { InstallDeviceState } from '@ui/features/install/home/types.ts'
import type { DeviceInUse } from '@ui/hooks/use-selection.ts'

/** An Apple TV or Vision Pro (paired by code) can't be installed to yet: installs to them come with 11.3b. */
export const installDeviceState = (
  inUse: DeviceInUse | undefined,
  state: DeviceState | undefined
): InstallDeviceState | undefined =>
  inUse?.device?.pairedByCode ? 'later' : state

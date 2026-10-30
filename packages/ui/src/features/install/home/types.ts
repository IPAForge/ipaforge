import type { DeviceState } from '@ui/features/devices/types.ts'
import type { usePlanInstall } from '@ui/hooks/queries/use-plan-install.ts'

export type PlanQuery = ReturnType<typeof usePlanInstall>

/** The device's state as an install sees it: `later` for an Apple TV or Vision Pro, which installs come to later. */
export type InstallDeviceState = DeviceState | 'later'

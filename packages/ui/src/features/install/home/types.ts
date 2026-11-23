import type { DeviceState } from '@ui/features/devices/types.ts'
import type { usePlanInstall } from '@ui/hooks/queries/use-plan-install.ts'

export type PlanQuery = ReturnType<typeof usePlanInstall>

/** The device's state as a SideStore install sees it: `noSideStore` for an Apple TV or Vision Pro, which it isn't for. */
export type InstallDeviceState = DeviceState | 'noSideStore'

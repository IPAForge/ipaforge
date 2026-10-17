import {
  DeviceNotice,
  NoDeviceNotice
} from '@ui/features/devices/device-notice.tsx'
import { useDeviceView } from '@ui/features/devices/use-device-view.ts'
import { useDeviceInUse } from '@ui/hooks/use-selection.ts'

/** What to fix on the device in use before installing; nothing when it is ready. */
export const DeviceInUseNotice = () => {
  const inUse = useDeviceInUse()
  const view = useDeviceView(inUse?.udid, inUse?.device)
  if (!inUse) return <NoDeviceNotice />

  return <DeviceNotice udid={inUse.udid} view={view} />
}

import { PickerItem } from '@ui/components/shell/picker-item.tsx'
import { useDeviceView } from '@ui/features/devices/hooks/use-device-view.ts'
import type { ListedDevice } from '@ui/hooks/queries/use-devices.ts'

type DeviceItemProps = {
  udid: string
  device: ListedDevice | undefined
}

/** One device in the menu: its name, details and state. */
export const DeviceItem = ({ udid, device }: DeviceItemProps) => {
  const view = useDeviceView(udid, device)

  return (
    <PickerItem
      id={udid}
      title={view.name}
      subtitle={view.subtitle}
      tone={view.tone}
    />
  )
}

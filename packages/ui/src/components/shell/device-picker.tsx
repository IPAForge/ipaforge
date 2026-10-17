import { Dropdown } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import type { Key } from 'react'
import { useTranslation } from 'react-i18next'

import { OPEN_DEVICES } from '@ui/components/shell/constants.ts'
import { DeviceItem } from '@ui/components/shell/device-item.tsx'
import { EmptyItem } from '@ui/components/shell/empty-item.tsx'
import { TopBarPicker } from '@ui/components/shell/top-bar-picker.tsx'
import { useDeviceView } from '@ui/features/devices/hooks/use-device-view.ts'
import { useRefreshDeviceStatus } from '@ui/hooks/queries/use-device-status.ts'
import { type ListedDevice, useDevices } from '@ui/hooks/queries/use-devices.ts'
import { useDeviceInUse, useSelection } from '@ui/hooks/use-selection.ts'

/**
 * The device picker: every connected device with its state (and the picked one while it is unplugged). Opening it
 * reads every device's status again; picking one keeps it for next time.
 */
export const DevicePicker = () => {
  const { t } = useTranslation()
  const devices = useDevices().data ?? []
  const inUse = useDeviceInUse()
  const view = useDeviceView(inUse?.udid, inUse?.device)
  const { select } = useSelection()
  const refresh = useRefreshDeviceStatus()
  const navigate = useNavigate()
  const listed: { udid: string; device: ListedDevice | undefined }[] =
    devices.map((device) => ({ udid: device.udid, device }))
  if (inUse && !inUse.isConnected)
    listed.push({ udid: inUse.udid, device: undefined })
  const onOpenChange = (isOpen: boolean) => {
    if (isOpen) refresh()
  }
  const onSelectionChange = (keys: 'all' | Set<Key>) => {
    const [udid] = keys === 'all' ? [] : keys
    if (typeof udid === 'string') select('device', udid)
  }
  const onAction = (key: Key) => {
    if (key === OPEN_DEVICES) void navigate({ to: '/devices' })
  }

  return (
    <TopBarPicker
      label={t('topBar.device')}
      value={inUse ? view.name : t('topBar.noDevice')}
      tone={view.tone}
      status={view.stateText}
      menuLabel={t('topBar.deviceMenu')}
      onOpenChange={onOpenChange}
      onAction={onAction}
    >
      {listed.length > 0 ? (
        <Dropdown.Section
          selectionMode="single"
          selectedKeys={inUse ? [inUse.udid] : []}
          onSelectionChange={onSelectionChange}
        >
          {listed.map(({ udid, device }) => (
            <DeviceItem key={udid} udid={udid} device={device} />
          ))}
        </Dropdown.Section>
      ) : (
        <Dropdown.Section>
          <EmptyItem />
        </Dropdown.Section>
      )}
      <Dropdown.Section>
        <Dropdown.Item id={OPEN_DEVICES} textValue={t('topBar.openDevices')}>
          {t('topBar.openDevices')}
        </Dropdown.Item>
      </Dropdown.Section>
    </TopBarPicker>
  )
}

import { Card } from '@heroui/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@ui/components/page-header.tsx'
import { DeviceCard } from '@ui/features/devices/components/device-card.tsx'
import { EngineStatus } from '@ui/features/devices/components/engine-status.tsx'
import { useRefreshDeviceStatus } from '@ui/hooks/queries/use-device-status.ts'
import { useDevices } from '@ui/hooks/queries/use-devices.ts'
import { useDeviceInUse, useSelection } from '@ui/hooks/use-selection.ts'

/**
 * Manage → Devices: every connected device (and the picked one while it is unplugged) with its state and what to
 * do about it. Opening the page reads every device's status again.
 */
export const DevicesPage = () => {
  const { t } = useTranslation()
  const devices = useDevices().data ?? []
  const inUse = useDeviceInUse()
  const { select } = useSelection()
  const refresh = useRefreshDeviceStatus()
  const onUse = (udid: string) => select('device', udid)
  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader titleKey="nav.devices" descriptionKey="devices.description" />
      <EngineStatus />
      {devices.map((device) => (
        <DeviceCard
          key={device.udid}
          udid={device.udid}
          device={device}
          isInUse={device.udid === inUse?.udid}
          onUse={onUse}
        />
      ))}
      {inUse && !inUse.isConnected ? (
        <DeviceCard
          udid={inUse.udid}
          device={undefined}
          isInUse
          onUse={onUse}
        />
      ) : null}
      {devices.length === 0 && !inUse ? (
        <Card>
          <Card.Content className="flex flex-col items-center gap-1 py-8 text-center">
            <span className="font-medium">{t('devices.empty.title')}</span>
            <span className="text-muted text-sm">
              {t('devices.empty.body')}
            </span>
          </Card.Content>
        </Card>
      ) : null}
    </div>
  )
}

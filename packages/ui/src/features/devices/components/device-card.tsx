import { Button, Card, Chip } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { StatusDot } from '@ui/components/shell/status-dot.tsx'
import { CheckAgain } from '@ui/features/devices/components/check-again.tsx'
import { DeviceFact } from '@ui/features/devices/components/device-fact.tsx'
import { DeviceNotice } from '@ui/features/devices/components/device-notice.tsx'
import { deviceStateClasses } from '@ui/features/devices/constants.ts'
import { useDeviceView } from '@ui/features/devices/hooks/use-device-view.ts'
import type { ListedDevice } from '@ui/hooks/queries/use-devices.ts'

type DeviceCardProps = {
  udid: string
  /** Undefined for the picked device while it is unplugged. */
  device: ListedDevice | undefined
  isInUse: boolean
  onUse: (udid: string) => void
}

/**
 * One device: name, "in use" and its state on the first line with Use this device and Check again; model, iOS,
 * connection and UDID under it; and, when it isn't ready, a notice saying what to do.
 */
export const DeviceCard = ({
  udid,
  device,
  isInUse,
  onUse
}: DeviceCardProps) => {
  const { t } = useTranslation()
  const view = useDeviceView(udid, device)
  const state = view.state ?? 'checking'
  const info = view.check?.info
  const onUseThis = () => onUse(udid)

  return (
    <Card>
      <Card.Content className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusDot tone={view.tone} />
          <h2 className="min-w-0 truncate font-semibold">{view.name}</h2>
          {isInUse ? (
            <Chip size="sm" color="accent">
              {t('devices.inUse')}
            </Chip>
          ) : null}
          <span className={`text-sm ${deviceStateClasses[state]}`}>
            {t(`devices.state.${state}`)}
          </span>
          <div className="ms-auto flex gap-2">
            {isInUse || !device ? null : (
              <Button size="sm" variant="tertiary" onPress={onUseThis}>
                {t('devices.use')}
              </Button>
            )}
            {device ? <CheckAgain udid={udid} /> : null}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {info ? (
            <>
              <DeviceFact label={t('devices.facts.model')}>
                {info.productType}
              </DeviceFact>
              <DeviceFact label={t('devices.facts.ios')}>
                {info.productVersion}
              </DeviceFact>
            </>
          ) : null}
          <DeviceFact label={t('devices.facts.connection')}>
            {view.link || t('devices.state.notConnected')}
          </DeviceFact>
          <DeviceFact
            label={t('devices.facts.udid')}
            className="col-span-2 sm:col-span-4"
          >
            {udid}
          </DeviceFact>
        </dl>
        <DeviceNotice udid={udid} view={view} showCheckAgain={false} />
      </Card.Content>
    </Card>
  )
}

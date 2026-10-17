import { Button, Card, Chip } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { StatusDot } from '@ui/components/shell/status-dot.tsx'
import {
  CheckAgain,
  DeviceNotice
} from '@ui/features/devices/device-notice.tsx'
import type { DeviceState } from '@ui/features/devices/device-state.ts'
import { useDeviceView } from '@ui/features/devices/use-device-view.ts'
import type { ListedDevice } from '@ui/hooks/queries/use-devices.ts'

const stateClasses = {
  checking: 'text-muted',
  ready: 'text-success',
  locked: 'text-warning',
  developerModeOff: 'text-warning',
  notTrusted: 'text-danger',
  unavailable: 'text-danger',
  notConnected: 'text-muted'
} as const satisfies Record<DeviceState, string>

type DeviceCardProps = {
  udid: string
  /** Undefined for the picked device while it is unplugged. */
  device: ListedDevice | undefined
  isInUse: boolean
  onUse: (udid: string) => void
}

/** A label over its value, in the card's facts grid. */
const Fact = ({
  label,
  children,
  className = ''
}: {
  label: string
  children: string
  className?: string
}) => (
  <div className={`flex min-w-0 flex-col ${className}`}>
    <dt className="text-muted text-xs">{label}</dt>
    <dd className="truncate text-sm" title={children}>
      {children}
    </dd>
  </div>
)

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
          <span className={`text-sm ${stateClasses[state]}`}>
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
              <Fact label={t('devices.facts.model')}>{info.productType}</Fact>
              <Fact label={t('devices.facts.ios')}>{info.productVersion}</Fact>
            </>
          ) : null}
          <Fact label={t('devices.facts.connection')}>
            {view.link || t('devices.state.notConnected')}
          </Fact>
          <Fact
            label={t('devices.facts.udid')}
            className="col-span-2 sm:col-span-4"
          >
            {udid}
          </Fact>
        </dl>
        <DeviceNotice udid={udid} view={view} showCheckAgain={false} />
      </Card.Content>
    </Card>
  )
}

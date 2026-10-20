import { useTranslation } from 'react-i18next'

import { PortalCard } from '@ui/features/developer/components/portal-card.tsx'
import { PortalList } from '@ui/features/developer/components/portal-list.tsx'
import { PortalRow } from '@ui/features/developer/components/portal-row.tsx'
import { PAID_DEVICE_LIMIT } from '@ui/features/developer/constants.ts'
import type { PortalContext, PortalData } from '@ui/features/developer/types.ts'

type DevicesPanelProps = {
  context: PortalContext
  devices: PortalData['devices']
}

/** The devices registered to the team (signed apps run only on these), the one connected tagged; paid teams' yearly limit. */
export const DevicesPanel = ({ context, devices }: DevicesPanelProps) => {
  const { t } = useTranslation()
  const data = devices.data
  const items = data?.devices ?? []
  const isPaid = data !== undefined && !data.team.isFree

  return (
    <PortalCard
      title={t('portal.tabs.devices')}
      hint={t(isPaid ? 'portal.devices.hintPaid' : 'portal.devices.hintFree')}
      summary={
        isPaid
          ? t('portal.devices.used', {
              count: items.length,
              max: PAID_DEVICE_LIMIT
            })
          : undefined
      }
    >
      <PortalList
        label={t('portal.tabs.devices')}
        isPending={devices.isPending}
        error={devices.error}
        isEmpty={items.length === 0}
        emptyKey="portal.devices.empty"
      >
        {items.map((device) => (
          <PortalRow
            key={device.udid}
            view={{
              id: device.udid,
              title: device.name ?? t('portal.devices.unnamed'),
              tags:
                device.udid === context.device?.udid
                  ? [{ labelKey: 'portal.devices.connected', tone: 'ok' }]
                  : [],
              code: device.udid,
              details: []
            }}
          />
        ))}
      </PortalList>
    </PortalCard>
  )
}

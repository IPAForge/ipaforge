import { Button, Card } from '@heroui/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@ui/components/page-header.tsx'
import { DeviceChecklist } from '@ui/features/devices/checklist/components/device-checklist.tsx'
import { CodePairedCard } from '@ui/features/devices/components/code-paired-card.tsx'
import { DeviceCard } from '@ui/features/devices/components/device-card.tsx'
import { EngineStatus } from '@ui/features/devices/components/engine-status.tsx'
import { LocalNetworkNotice } from '@ui/features/devices/components/local-network-notice.tsx'
import { PairDialog } from '@ui/features/devices/pair/pair-dialog.tsx'
import { useCodePairedDevices } from '@ui/hooks/queries/use-code-paired.ts'
import { useRefreshDeviceStatus } from '@ui/hooks/queries/use-device-status.ts'
import { useDevices } from '@ui/hooks/queries/use-devices.ts'
import { useDeviceInUse, useSelection } from '@ui/hooks/use-selection.ts'

/**
 * Manage → Devices: every connected iPhone and iPad, by cable or on Wi-Fi (and the picked one while it is
 * unplugged), and every Apple TV and Vision Pro paired by code, on the network or not, each with its state and
 * what to do about it; a note when macOS refuses the search on Wi-Fi; and "Pair Apple TV or Vision Pro…". Opening
 * the page reads every device's status again.
 */
export const DevicesPage = () => {
  const { t } = useTranslation()
  const devices = useDevices().data ?? []
  const codePaired = useCodePairedDevices().data ?? []
  const inUse = useDeviceInUse()
  const { select } = useSelection()
  const refresh = useRefreshDeviceStatus()
  // Open with the name of the device to pair again, or none for a new one.
  const [pairing, setPairing] = useState<{ again?: string } | undefined>()
  const onUse = (udid: string) => select('device', udid)
  const onPair = () => setPairing({})
  const onPairAgain = (name: string) => setPairing({ again: name })
  const onPairingClose = () => setPairing(undefined)
  useEffect(() => {
    refresh()
  }, [refresh])
  const isCodePaired = (udid: string) =>
    codePaired.some((paired) => paired.udid === udid)
  const phones = devices.filter(
    (device) => !device.pairedByCode && !isCodePaired(device.udid)
  )
  const isEmpty = phones.length === 0 && codePaired.length === 0 && !inUse

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-80">
          <PageHeader
            titleKey="nav.devices"
            descriptionKey="devices.description"
          />
        </div>
        <Button data-pair="open" onPress={onPair}>
          {t('pairByCode.open')}
        </Button>
      </div>
      <EngineStatus />
      <LocalNetworkNotice />
      {phones.map((device) => (
        <div key={device.udid} className="flex flex-col gap-3">
          <DeviceCard
            udid={device.udid}
            device={device}
            isInUse={device.udid === inUse?.udid}
            onUse={onUse}
          />
          <DeviceChecklist udid={device.udid} device={device} />
        </div>
      ))}
      {codePaired.map((paired) => (
        <CodePairedCard
          key={paired.udid}
          paired={paired}
          device={devices.find((device) => device.udid === paired.udid)}
          isInUse={paired.udid === inUse?.udid}
          onUse={onUse}
          onPairAgain={onPairAgain}
        />
      ))}
      {inUse && !inUse.isConnected && !isCodePaired(inUse.udid) ? (
        <DeviceCard
          udid={inUse.udid}
          device={undefined}
          isInUse
          onUse={onUse}
        />
      ) : null}
      {isEmpty ? (
        <Card>
          <Card.Content className="flex flex-col items-center gap-1 py-8 text-center">
            <span className="font-medium">{t('devices.empty.title')}</span>
            <span className="text-muted text-sm">
              {t('devices.empty.body')}
            </span>
          </Card.Content>
        </Card>
      ) : null}
      {pairing ? (
        <PairDialog againName={pairing.again} onClose={onPairingClose} />
      ) : null}
    </div>
  )
}

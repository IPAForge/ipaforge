import { Button, Card, Chip } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusDot } from '@ui/components/shell/status-dot.tsx'
import { CheckAgain } from '@ui/features/devices/components/check-again.tsx'
import { CodePairedNotice } from '@ui/features/devices/components/code-paired-notice.tsx'
import { DeviceFact } from '@ui/features/devices/components/device-fact.tsx'
import { DeviceKindIcon } from '@ui/features/devices/components/device-kind-icon.tsx'
import { ForgetConfirm } from '@ui/features/devices/components/forget-confirm.tsx'
import { deviceStateClasses } from '@ui/features/devices/constants.ts'
import { useDeviceView } from '@ui/features/devices/hooks/use-device-view.ts'
import { deviceKind } from '@ui/features/devices/utils/device-kind.ts'
import { modelName } from '@ui/features/devices/utils/model-name.ts'
import type { ListedDevice } from '@ui/hooks/queries/use-devices.ts'
import type { CodePairedDevice } from '@ui/services/engine/types.ts'

type CodePairedCardProps = {
  paired: CodePairedDevice
  /** As the network search found it; undefined while it isn't on the network. */
  device: ListedDevice | undefined
  isInUse: boolean
  onUse: (udid: string) => void
  /** Opens the pairing dialog for this device ("Pair again…"). */
  onPairAgain: (name: string) => void
}

/**
 * An Apple TV or Vision Pro paired by code: its name, state and kind; model, tvOS or visionOS, connection, how it's
 * paired and its address; Use this device, Check again and Forget…. It has no cable and no classic pairing, so no
 * pairing file to save and no iPhone checklist.
 */
export const CodePairedCard = ({
  paired,
  device,
  isInUse,
  onUse,
  onPairAgain
}: CodePairedCardProps) => {
  const { t } = useTranslation()
  const [isForgetting, setForgetting] = useState(false)
  const { udid } = paired
  const view = useDeviceView(udid, device)
  const info = view.check?.info
  const productType = info?.productType ?? paired.model
  const kind = deviceKind(productType)
  const name = view.isNamed
    ? view.name
    : (paired.name ?? t('devices.unknownDevice'))
  const state = view.state ?? 'checking'
  const onUseThis = () => onUse(udid)
  const onForget = () => setForgetting(true)
  const onKeep = () => setForgetting(false)
  const onPairAgainThis = () => onPairAgain(name)

  return (
    <Card>
      <Card.Content className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <DeviceKindIcon kind={kind} className="size-5 shrink-0 text-muted" />
          <StatusDot tone={view.tone} />
          <h2 className="min-w-0 truncate font-semibold">{name}</h2>
          {isInUse ? (
            <Chip size="sm" color="accent">
              {t('devices.inUse')}
            </Chip>
          ) : null}
          <span className={`text-sm ${deviceStateClasses[state]}`}>
            {t(`devices.state.${state}`)}
          </span>
          <div className="ms-auto flex flex-wrap gap-2">
            {isInUse || !device ? null : (
              <Button size="sm" variant="tertiary" onPress={onUseThis}>
                {t('devices.use')}
              </Button>
            )}
            {device ? <CheckAgain udid={udid} /> : null}
            <Button size="sm" variant="tertiary" onPress={onForget}>
              {t('devices.forget.action')}
            </Button>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {productType ? (
            // "Apple TV 4K (3rd generation)" needs the room of two columns.
            <DeviceFact label={t('devices.facts.model')} className="col-span-2">
              {modelName(productType)}
            </DeviceFact>
          ) : null}
          {info && kind ? (
            <DeviceFact label={t(`devices.os.${kind}`)}>
              {info.productVersion}
            </DeviceFact>
          ) : null}
          <DeviceFact label={t('devices.facts.connection')}>
            {view.link || t('devices.state.notConnected')}
          </DeviceFact>
          <DeviceFact label={t('devices.facts.pairing')} className="col-span-2">
            {t('devices.pairedByCode')}
          </DeviceFact>
          {device?.address ? (
            <DeviceFact
              label={t('devices.facts.address')}
              className="col-span-2"
            >
              {device.address}
            </DeviceFact>
          ) : null}
        </dl>
        <CodePairedNotice
          udid={udid}
          view={view}
          name={name}
          kind={kind}
          onPairAgain={onPairAgainThis}
        />
        {isForgetting ? (
          <ForgetConfirm udid={udid} name={name} onCancel={onKeep} />
        ) : null}
      </Card.Content>
    </Card>
  )
}

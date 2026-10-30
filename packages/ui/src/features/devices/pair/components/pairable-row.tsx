import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { DeviceKindIcon } from '@ui/features/devices/components/device-kind-icon.tsx'
import { deviceKind } from '@ui/features/devices/utils/device-kind.ts'
import { modelName } from '@ui/features/devices/utils/model-name.ts'
import type { PairableDevice } from '@ui/services/engine/types.ts'

type PairableRowProps = {
  device: PairableDevice
  onPair: (device: PairableDevice) => void
}

/** One device showing its pairing screen: its kind, name and model, and Pair. */
export const PairableRow = ({ device, onPair }: PairableRowProps) => {
  const { t } = useTranslation()
  const onPairThis = () => onPair(device)

  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <DeviceKindIcon
        kind={deviceKind(device.model)}
        className="size-5 shrink-0 text-muted"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{device.name}</span>
        <span className="truncate text-muted text-xs">
          {device.model ? modelName(device.model) : t('pairByCode.showing')}
        </span>
      </span>
      <Button
        size="sm"
        data-pair="device"
        aria-label={t('pairByCode.pairNamed', { name: device.name })}
        onPress={onPairThis}
      >
        {t('pairByCode.pair')}
      </Button>
    </li>
  )
}

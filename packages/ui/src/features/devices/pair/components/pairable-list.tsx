import { useTranslation } from 'react-i18next'

import { PairableRow } from '@ui/features/devices/pair/components/pairable-row.tsx'
import type { PairableDevice } from '@ui/services/engine/types.ts'

type PairableListProps = {
  devices: readonly PairableDevice[]
  onPair: (device: PairableDevice) => void
}

/** The devices showing their pairing screen, each with Pair. */
export const PairableList = ({ devices, onPair }: PairableListProps) => {
  const { t } = useTranslation()

  return (
    <ul
      aria-label={t('pairByCode.found')}
      className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border"
    >
      {devices.map((device) => (
        <PairableRow key={device.id} device={device} onPair={onPair} />
      ))}
    </ul>
  )
}

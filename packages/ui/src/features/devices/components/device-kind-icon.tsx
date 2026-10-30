import { Smartphone } from 'lucide-react'

import { deviceKindIcons } from '@ui/features/devices/constants.ts'
import type { DeviceKind } from '@ui/features/devices/types.ts'

type DeviceKindIconProps = {
  /** None: an iPhone or iPad, or a device whose kind isn't known yet. */
  kind: DeviceKind | undefined
  className?: string
}

/** A TV for an Apple TV, a headset for a Vision Pro, a phone for the rest. Decorative: the name says what it is. */
export const DeviceKindIcon = ({
  kind,
  className = 'size-5'
}: DeviceKindIconProps) => {
  const Icon = kind ? deviceKindIcons[kind] : Smartphone

  return <Icon aria-hidden="true" className={className} />
}

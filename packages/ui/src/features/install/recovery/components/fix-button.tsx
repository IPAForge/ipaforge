import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import type { RecoveryAction } from '@ipaforge/rpc'
import { fixes } from '@ui/features/install/recovery/constants.ts'
import type {
  FixHandlers,
  FixLabelValues
} from '@ui/features/install/recovery/types.ts'

type FixButtonProps = {
  action: RecoveryAction
  handlers: FixHandlers
  /** The first fix's button: filled, with its own label ("It's on, try again"). */
  isFirst?: boolean
  isPending?: boolean
  /** Values for the label ("Install from {channel}"). */
  labelValues?: FixLabelValues | undefined
}

/** The button for one fix; a fix that only explains has none. */
export const FixButton = ({
  action,
  handlers,
  isFirst = false,
  isPending = false,
  labelValues
}: FixButtonProps) => {
  const { t } = useTranslation()
  const fix = fixes[action]
  if (fix.kind === 'info' || fix.kind === 'later') return null
  // A channel fix always says which channel; others use their own label unless they're first.
  const usesButtonLabel = isFirst || fix.kind === 'channel'
  const label =
    usesButtonLabel && 'buttonKey' in fix
      ? t(fix.buttonKey, { channel: labelValues?.channel ?? '' })
      : t(`recovery.${action}`)

  return (
    <Button
      size="sm"
      variant={isFirst ? 'primary' : 'secondary'}
      onPress={handlers[fix.kind]}
      isPending={isPending}
    >
      {label}
    </Button>
  )
}

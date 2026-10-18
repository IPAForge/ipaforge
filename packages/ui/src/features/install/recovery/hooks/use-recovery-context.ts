import { useTranslation } from 'react-i18next'

import type { RecoveryContext } from '@ui/features/install/recovery/types.ts'
import { otherChannel } from '@ui/features/install/recovery/utils/other-channel.ts'
import { useRunPlan } from '@ui/features/install/run/hooks/use-run-plan.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { ActiveRun } from '@ui/state/active-run/types.ts'

/**
 * What the fixes say about this failure in particular: the channel a "use the other channel" fix starts again on,
 * and when the next App ID frees (from the install's plan, when it is known).
 */
export const useRecoveryContext = (run: ActiveRun): RecoveryContext => {
  const { t } = useTranslation()
  const { date } = useFormat()
  const nextSlotAt = useRunPlan(run)?.appIds.nextSlotAt
  const channel =
    run.kind === 'sidestore' ? otherChannel(run.input.channel) : 'stable'

  return {
    labelValues: { channel: t(`install.channel.${channel}`) },
    nextAppIdSlot: nextSlotAt ? date(new Date(nextSlotAt)) : undefined
  }
}

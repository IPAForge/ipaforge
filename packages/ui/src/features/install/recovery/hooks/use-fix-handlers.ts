import { useNavigate } from '@tanstack/react-router'

import { usePairDevice } from '@ui/features/devices/hooks/use-pair-device.ts'
import type { FixHandlers } from '@ui/features/install/recovery/types.ts'
import { otherChannel } from '@ui/features/install/recovery/utils/other-channel.ts'
import { ANISETTE_CARD_ID } from '@ui/features/settings/anisette/constants.ts'
import { useRun } from '@ui/hooks/use-run.ts'
import type { ActiveRun } from '@ui/state/active-run/types.ts'

/**
 * What each kind of fix does for a failed run: continue from the checkpoint (or start again without one), ask the
 * device to trust this computer and then continue, open the Apple ID picker, start again on the other channel, or
 * open the anisette servers in Settings.
 */
export const useFixHandlers = (
  run: ActiveRun,
  onChooseAccount: () => void
): FixHandlers & { readonly isPairing: boolean } => {
  const { resume, restart } = useRun()
  const pair = usePairDevice(run.input.udid)
  const navigate = useNavigate()
  const onContinue = () => (run.view.checkpoint ? resume() : restart({}))

  return {
    resume: onContinue,
    pair: () => pair.mutate(undefined, { onSuccess: onContinue }),
    account: onChooseAccount,
    tryAnyway: () => restart({ tryAnyway: true }),
    channel: () => {
      if (run.kind === 'sidestore')
        restart({ channel: otherChannel(run.input.channel) })
    },
    settings: () => {
      void navigate({ to: '/settings', hash: ANISETTE_CARD_ID })
    },
    isPairing: pair.isPending
  }
}

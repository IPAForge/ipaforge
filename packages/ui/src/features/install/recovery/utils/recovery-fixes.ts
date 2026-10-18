import type { RecoveryAction } from '@ipaforge/rpc'
import { fixes } from '@ui/features/install/recovery/constants.ts'
import type { RecoveryFixes } from '@ui/features/install/recovery/types.ts'
import type { RunKind } from '@ui/state/active-run/types.ts'

/**
 * The fixes to show for a failure, in the Engine's order: those whose screen comes later are left out, so is
 * another channel for a run without one (apps), and Try again isn't offered twice when the first fix already
 * continues the run.
 */
export const recoveryFixes = (
  actions: readonly RecoveryAction[],
  kind: RunKind = 'sidestore'
): RecoveryFixes => {
  const hidden = kind === 'apps' ? ['later', 'channel'] : ['later']
  const shown = actions.filter((action) => !hidden.includes(fixes[action].kind))
  const [first, ...rest] = shown
  const others =
    first && fixes[first].kind === 'resume'
      ? rest.filter((action) => action !== 'retry')
      : rest

  return { first, others }
}

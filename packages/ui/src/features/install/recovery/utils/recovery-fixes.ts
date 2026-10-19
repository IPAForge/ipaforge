import type { RecoveryAction } from '@ipaforge/rpc'
import { fixes } from '@ui/features/install/recovery/constants.ts'
import type { RecoveryFixes } from '@ui/features/install/recovery/types.ts'
import type { RunKind } from '@ui/state/active-run/types.ts'

/**
 * The fixes to show for a failure, in the Engine's order: those whose screen comes later are left out, so is
 * another channel for a run without one (apps), and Try again isn't offered twice when the first fix already
 * continues the run. Try anyway shows only when Apple's App ID count was negative, as the first fix.
 */
export const recoveryFixes = (
  actions: readonly RecoveryAction[],
  kind: RunKind = 'sidestore',
  isCountUnreliable = false
): RecoveryFixes => {
  const hidden = kind === 'apps' ? ['later', 'channel'] : ['later']
  // Try anyway only when Apple's App ID count was negative, and then first: the count is what's wrong.
  const ordered = isCountUnreliable
    ? [
        ...actions.filter((action) => fixes[action].kind === 'tryAnyway'),
        ...actions.filter((action) => fixes[action].kind !== 'tryAnyway')
      ]
    : actions.filter((action) => fixes[action].kind !== 'tryAnyway')
  const shown = ordered.filter((action) => !hidden.includes(fixes[action].kind))
  const [first, ...rest] = shown
  const others =
    first && fixes[first].kind === 'resume'
      ? rest.filter((action) => action !== 'retry')
      : rest

  return { first, others }
}

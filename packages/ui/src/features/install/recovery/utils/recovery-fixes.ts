import type { RecoveryAction } from '@loadstar/rpc'
import { fixes } from '@ui/features/install/recovery/constants.ts'
import type { RecoveryFixes } from '@ui/features/install/recovery/types.ts'

/**
 * The fixes to show for a failure, in the Engine's order: those whose screen comes later are left out, and Try
 * again isn't offered twice when the first fix already continues the run.
 */
export const recoveryFixes = (
  actions: readonly RecoveryAction[]
): RecoveryFixes => {
  const shown = actions.filter((action) => fixes[action].kind !== 'later')
  const [first, ...rest] = shown
  const others =
    first && fixes[first].kind === 'resume'
      ? rest.filter((action) => action !== 'retry')
      : rest

  return { first, others }
}

import type { RemotePlanInstallInput } from '@ipaforge/rpc'
import { planInput } from '@ui/features/install/utils/plan-input.ts'
import type { ActiveRun } from '@ui/state/active-run/types.ts'

/**
 * The plan query a run's summary and recovery read (App IDs left, when the next frees, free-app slots): the
 * SideStore install's, or for an apps run its first app's, the same query the page already made.
 */
export const runPlanInput = (
  run: ActiveRun
): RemotePlanInstallInput | undefined => {
  if (run.kind === 'sidestore') return planInput(run.input)
  const [first] = run.input.apps

  return first
    ? { udid: run.input.udid, accountId: run.input.accountId, source: first }
    : undefined
}

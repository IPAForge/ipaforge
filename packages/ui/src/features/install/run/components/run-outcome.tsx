import { Cancelled } from '@ui/features/install/run/components/cancelled.tsx'
import { Done } from '@ui/features/install/run/components/done.tsx'
import { Failed } from '@ui/features/install/run/components/failed.tsx'
import { RunningActions } from '@ui/features/install/run/components/running-actions.tsx'
import type { OutcomeProps } from '@ui/features/install/run/types.ts'

/** Over the steps: Cancel while it runs, Resume when stopped, what to do on the device when done, the failure. */
export const RunOutcome = ({ run, target }: OutcomeProps) => {
  const { status, failure } = run.view
  if (status === 'completed') return <Done target={target} />
  if (status === 'cancelled') return <Cancelled run={run} />
  if (status === 'failed' && failure)
    return <Failed run={run} failure={failure} target={target} />
  return <RunningActions run={run} />
}

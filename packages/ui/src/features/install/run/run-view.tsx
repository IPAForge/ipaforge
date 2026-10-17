import { RunHeader } from '@ui/features/install/run/run-header.tsx'
import { RunOutcome } from '@ui/features/install/run/run-outcome.tsx'
import { RunSummary } from '@ui/features/install/run/run-summary.tsx'
import { StepList } from '@ui/features/install/run/step-list.tsx'
import { useRunTarget } from '@ui/features/install/run/use-run-target.ts'
import type { ActiveRun } from '@ui/state/active-run/active-run-store.ts'

/**
 * An install run, in one full-width column: title and overall progress, what is being installed, how it is going
 * or how it ended (so the result is seen without scrolling), then every step.
 */
export const RunView = ({ run }: { run: ActiveRun }) => {
  const target = useRunTarget(run.input)

  return (
    <div className="flex w-full flex-col gap-5">
      <RunHeader view={run.view} target={target} />
      <RunSummary target={target} accountId={run.input.accountId} />
      <RunOutcome run={run} target={target} />
      <StepList steps={run.view.steps} />
    </div>
  )
}

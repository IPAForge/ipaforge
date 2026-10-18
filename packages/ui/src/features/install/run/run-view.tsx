import { RunHeader } from '@ui/features/install/run/components/run-header.tsx'
import { RunOutcome } from '@ui/features/install/run/components/run-outcome.tsx'
import { RunSummary } from '@ui/features/install/run/components/run-summary.tsx'
import { StepList } from '@ui/features/install/run/components/step-list.tsx'
import { useRunPlan } from '@ui/features/install/run/hooks/use-run-plan.ts'
import { useRunTarget } from '@ui/features/install/run/hooks/use-run-target.ts'
import type { ActiveRun } from '@ui/state/active-run/types.ts'

type RunViewProps = { run: ActiveRun }

/**
 * An install run, in one full-width column: title and overall progress, what is being installed, how it is going
 * or how it ended (so the result is seen without scrolling), then every step.
 */
export const RunView = ({ run }: RunViewProps) => {
  const target = useRunTarget(run.input)
  const plan = useRunPlan(run.input)

  return (
    <div className="flex w-full flex-col gap-5">
      <RunHeader view={run.view} target={target} />
      <RunSummary target={target} accountId={run.input.accountId} plan={plan} />
      <RunOutcome run={run} target={target} />
      <StepList steps={run.view.steps} />
    </div>
  )
}

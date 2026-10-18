import { runPlanInput } from '@ui/features/install/run/utils/run-plan-input.ts'
import { usePlanInstall } from '@ui/hooks/queries/use-plan-install.ts'
import type { ActiveRun } from '@ui/state/active-run/types.ts'

/** The plan of the install a run is doing: usually already read by the page, so no request is made. */
export const useRunPlan = (run: ActiveRun) =>
  usePlanInstall(runPlanInput(run)).data

import { planInput } from '@ui/features/install/utils/plan-input.ts'
import { usePlanInstall } from '@ui/hooks/queries/use-plan-install.ts'
import type { InstallSideStoreInput } from '@ui/services/engine/types.ts'

/** The plan of the install a run is doing: usually already read by the home page, so no request is made. */
export const useRunPlan = (input: InstallSideStoreInput) =>
  usePlanInstall(planInput(input)).data

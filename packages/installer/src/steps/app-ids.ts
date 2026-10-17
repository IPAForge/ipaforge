// Plans each app's new identity under the team and checks the App ID budget for all of them at once, so a run
// that cannot fit fails before it creates a single App ID.
import type { FlowRuntime } from '@installer/application/runtime.ts'
import {
  assertAppIdBudget,
  plannedIdentifiers
} from '@installer/domain/app-id-budget.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { InstallState } from '@installer/domain/types.ts'
import type { Step } from '@installer/pipeline/types.ts'
import { required } from '@installer/steps/app-job.ts'
import { planSideloadIdentity } from '@loadstar/signer'

export const appIdsStep = (runtime: FlowRuntime): Step<InstallState> => ({
  id: 'app-ids',
  labelKey: StepLabel.appIds,
  weight: StepWeight.appleRequest,
  idempotent: true,
  run: async (state) => {
    const team = required(state.team, 'team')
    const apps = state.apps.map((job) => ({
      ...job,
      identity: planSideloadIdentity(
        required(job.inspection, 'inspection'),
        team.id
      )
    }))
    const developer = await runtime.developer(state.accountId)
    assertAppIdBudget(
      await developer.planAppIds(
        team,
        plannedIdentifiers(apps.map((job) => job.identity))
      )
    )
    return { apps }
  }
})

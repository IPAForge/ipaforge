import type { FlowRuntime } from '@installer/application/runtime.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { InstallState } from '@installer/domain/types.ts'
import type { Step } from '@installer/pipeline/types.ts'
import {
  appStepId,
  jobAt,
  required,
  updateJob
} from '@installer/steps/app-job.ts'
import { compact } from '@loadstar/kernel'

/** App IDs, the app group and a profile for every bundle of the app. */
export const provisionStep = (
  runtime: FlowRuntime,
  index: number
): Step<InstallState> => ({
  id: appStepId('provision', index),
  labelKey: StepLabel.provision,
  weight: StepWeight.provision,
  run: async (state) => {
    const identity = required(jobAt(state, index).identity, 'identity plan')
    const device = required(state.device, 'device')
    const developer = await runtime.developer(state.accountId)
    const { profiles } = await developer.provisionApp(
      compact({
        team: required(state.team, 'team'),
        device: { udid: device.udid, name: device.name },
        bundles: identity.bundles,
        appGroup: identity.appGroup
      })
    )

    return updateJob(state, index, { profiles })
  }
})

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
import type { ProvisionProgress } from '@ipaforge/apple'
import { compact } from '@ipaforge/kernel'

/** App IDs, the app group and a profile for every bundle of the app, reporting each request to Apple. */
export const provisionStep = (
  runtime: FlowRuntime,
  index: number
): Step<InstallState> => ({
  id: appStepId('provision', index),
  labelKey: StepLabel.provision,
  weight: StepWeight.provision,
  run: async (state, context) => {
    const identity = required(jobAt(state, index).identity, 'identity plan')
    const device = required(state.device, 'device')
    const developer = await runtime.developer(state.accountId)
    const now = () => runtime.deps.clock.now().getTime()
    const started = now()
    const { profiles } = await developer.provisionApp(
      compact({
        team: required(state.team, 'team'),
        device: { udid: device.udid, name: device.name },
        bundles: identity.bundles,
        appGroup: identity.appGroup,
        // Each request to Apple as it finishes: what it was part of, so the UI can say "Getting profiles · 2 of 5".
        onProgress: ({ task, done, total, fraction }: ProvisionProgress) =>
          context.progress(fraction, {
            phase: 'provisioning',
            task,
            done,
            total,
            elapsedMs: now() - started
          })
      })
    )
    context.detail({ kind: 'profiles', count: profiles.size })

    return updateJob(state, index, { profiles })
  }
})

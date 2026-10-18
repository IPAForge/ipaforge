// Free teams only: makes sure the app fits under the device's free-app limit, asking which app to remove if not.
import { ensureFreeSlot } from '@installer/application/free-apps.ts'
import type { FlowRuntime } from '@installer/application/runtime.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { InstallState } from '@installer/domain/types.ts'
import type { Step } from '@installer/pipeline/types.ts'
import { appStepId, jobAt, required } from '@installer/steps/app-job.ts'
import { compact } from '@ipaforge/kernel'

export const freeAppsStep = (
  runtime: FlowRuntime,
  index: number
): Step<InstallState> => ({
  id: appStepId('free-apps', index),
  labelKey: StepLabel.freeApps,
  weight: StepWeight.check,
  skip: (state) => state.team?.isFree !== true,
  run: async (state, context) => {
    const { config } = runtime.deps
    const team = required(state.team, 'team')
    const identity = required(jobAt(state, index).identity, 'identity plan')
    const { used, removed } = await ensureFreeSlot(
      await runtime.device(state.udid),
      context,
      {
        rules: {
          freeTeamIds: new Set([team.id]),
          maxLifetimeMs: config.freeProfileMaxLifetimeMs
        },
        limit: config.freeAppLimit,
        installing: identity.newMainBundleId
      }
    )
    context.detail(
      compact({
        kind: 'free-apps' as const,
        used,
        limit: config.freeAppLimit,
        removed
      })
    )
    return undefined
  }
})

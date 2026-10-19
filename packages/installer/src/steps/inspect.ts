// Reads the IPA before any Apple call, so a broken or encrypted app, one the device cannot run (iOS too old,
// wrong device family, no 64-bit slice), or another app than the one a Refresh or Update replaces, fails without
// using up App IDs. The device step runs first.
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
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import { assertCompatible } from '@ipaforge/signer'

export const inspectStep = (
  runtime: FlowRuntime,
  index: number
): Step<InstallState> => ({
  id: appStepId('inspect', index),
  labelKey: StepLabel.inspect,
  weight: StepWeight.inspect,
  idempotent: true,
  run: async (state, context) => {
    const job = jobAt(state, index)
    const file = required(job.file, 'IPA file')
    const inspection = await runtime.deps.signer.inspect(file, context.signal)
    const replaces =
      job.source.kind === 'file' ? job.source.replaces : undefined

    if (replaces !== undefined && inspection.app.identifier !== replaces)
      throw new IPAForgeError(ErrorCode.WrongApp, {
        data: { expected: replaces, found: inspection.app.identifier }
      })
    assertCompatible(inspection, required(state.device, 'device summary'))
    context.detail(
      compact({
        kind: 'app' as const,
        name: inspection.app.name,
        version: inspection.app.version,
        extensions: inspection.nested.filter(
          (bundle) => bundle.kind === 'appex'
        ).length
      })
    )

    return updateJob(state, index, { inspection })
  }
})

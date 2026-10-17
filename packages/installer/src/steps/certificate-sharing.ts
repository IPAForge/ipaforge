// A manually imported IPA that would receive the signing certificate (it is SideStore, or LiveContainer with
// SideStore inside) gets it only after the user agrees. The bundle ID proves nothing: any IPA can claim it. If the
// user declines, the app is installed without the certificate.
import { ask } from '@installer/application/ask.ts'
import type { FlowRuntime } from '@installer/application/runtime.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { PromptKind } from '@installer/domain/prompts.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { InstallState } from '@installer/domain/types.ts'
import type { Step } from '@installer/pipeline/types.ts'
import { findSideStoreTarget } from '@installer/sidestore/target.ts'
import {
  appStepId,
  jobAt,
  required,
  updateJob
} from '@installer/steps/app-job.ts'
import { CANDIDATES } from '@installer/steps/constants.ts'

export const certificateSharingStep = (
  runtime: FlowRuntime,
  index: number
): Step<InstallState> => ({
  id: appStepId('certificate-sharing', index),
  labelKey: StepLabel.certificateSharing,
  weight: StepWeight.check,
  skip: (state) =>
    !CANDIDATES.has(jobAt(state, index).inspection?.app.identifier ?? ''),
  run: async (state, context) => {
    const job = jobAt(state, index)
    const inspection = required(job.inspection, 'inspection')
    const bundles = await runtime.deps.signer.bundles(
      required(job.file, 'IPA file'),
      context.signal
    )
    if (!findSideStoreTarget(bundles)) return undefined
    const approved = await ask(context, PromptKind.ShareCertificate, {
      appName: inspection.app.name,
      bundleId: inspection.app.identifier
    })

    return approved
      ? updateJob(state, index, { trust: { kind: 'user-approved' } })
      : undefined
  }
})

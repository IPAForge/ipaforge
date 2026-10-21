// Save signed .ipa instead: the app signed for the team, written to the folder the user picked on the computer
// instead of being installed. Its signed copy leaves the scratch store whatever happens.
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
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

/** `App 1.2.ipa` from the app's name and version: letters, digits, spaces and `. _ ( ) + @ -`, nothing else. */
export const signedIpaName = (name: string, version: string | undefined) =>
  `${
    [name, version]
      .filter(Boolean)
      .join(' ')
      .replace(/[^\p{L}\p{N} ._()+@-]/gu, '_')
      .trim()
      .slice(0, 120) || 'App'
  }.ipa`

export const saveSignedStep = (
  runtime: FlowRuntime,
  index: number,
  folder: string
): Step<InstallState> => ({
  id: appStepId('save', index),
  labelKey: StepLabel.save,
  weight: StepWeight.save,
  run: async (state, context) => {
    const output = runtime.deps.signedIpaFolder
    if (!output)
      throw new IPAForgeError(ErrorCode.Unexpected, {
        message: 'this host cannot save signed IPAs'
      })
    const job = jobAt(state, index)
    const signed = required(job.signed, 'signed IPA')
    const app = required(job.inspection, 'inspection').app
    try {
      const savedTo = await output.save(
        folder,
        signedIpaName(app.name, app.version),
        signed.file.stream()
      )
      runtime.deps.logger.info('signed IPA saved', {
        bundleId: app.identifier
      })
      context.detail({ kind: 'saved', path: savedTo })

      return updateJob(state, index, { savedTo })
    } finally {
      await runtime.deps.scratch.delete(signed.key)
    }
  }
})

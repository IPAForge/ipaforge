import { ensureTeamCertificate } from '@installer/application/certificate.ts'
import type { FlowRuntime } from '@installer/application/runtime.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import type { InstallState } from '@installer/domain/state.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { Step } from '@installer/pipeline/step.ts'
import { required } from '@installer/steps/app-job.ts'

/** Reuses or creates the team's certificate (revoke prompt at the limit); the key goes to the SecretStore. */
export const certificateStep = (runtime: FlowRuntime): Step<InstallState> => ({
  id: 'certificate',
  labelKey: StepLabel.certificate,
  weight: StepWeight.appleRequest,
  run: async (state, context) => {
    const developer = await runtime.developer(state.accountId)
    const team = required(state.team, 'team')
    const identity = await ensureTeamCertificate(
      runtime.deps,
      developer,
      context,
      {
        accountId: state.accountId,
        team
      }
    )

    return { certificateSerial: identity.certificate.serialNumber }
  }
})

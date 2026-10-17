import type { FlowRuntime } from '@installer/application/runtime.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { AccountState } from '@installer/domain/types.ts'
import type { Step } from '@installer/pipeline/types.ts'
import { required } from '@installer/steps/app-job.ts'

/**
 * Remembers the team for the account, so the next run does not ask again. (The certificate and its key were
 * stored by the certificate step as soon as they existed.)
 */
export const rememberTeamStep = <S extends AccountState>(
  runtime: FlowRuntime
): Step<S> => ({
  id: 'remember',
  labelKey: StepLabel.remember,
  weight: StepWeight.check,
  idempotent: true,
  run: async (state) => {
    await runtime.deps.apple.accounts.update(state.accountId, {
      teamId: required(state.team, 'team').id
    })
    return undefined
  }
})

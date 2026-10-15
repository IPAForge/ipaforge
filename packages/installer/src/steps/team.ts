import type { FlowRuntime } from '@installer/application/runtime.ts'
import { chooseTeam } from '@installer/application/team.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import type { AccountState } from '@installer/domain/state.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { Step } from '@installer/pipeline/step.ts'

/** Picks the developer team, asking only when the account has several and none is requested or remembered. */
export const teamStep = <S extends AccountState>(
  runtime: FlowRuntime
): Step<S> => ({
  id: 'team',
  labelKey: StepLabel.team,
  weight: StepWeight.appleRequest,
  run: async (state, context) => {
    const developer = await runtime.developer(state.accountId)
    const team = await chooseTeam(runtime.deps, developer, context, {
      accountId: state.accountId,
      requested: state.teamId
    })

    return { team } as Partial<S>
  }
})

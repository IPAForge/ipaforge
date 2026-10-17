import type { FlowRuntime } from '@installer/application/runtime.ts'
import { signInAccount } from '@installer/application/sign-in.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { AccountState } from '@installer/domain/types.ts'
import type { Step } from '@installer/pipeline/types.ts'

/** Opens the saved account (2FA and the password through prompts); the session stays in the run's runtime. */
export const signInStep = <S extends AccountState>(
  runtime: FlowRuntime
): Step<S> => ({
  id: 'sign-in',
  labelKey: StepLabel.signIn,
  weight: StepWeight.appleRequest,
  run: async (state, context) => {
    runtime.useSession(
      await signInAccount(runtime.deps, context, state.accountId)
    )
    return undefined
  }
})

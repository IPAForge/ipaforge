// signIn: adds an Apple ID. The password and the second factor are asked through prompts, so they never sit in
// the run's input, state or checkpoint; the saved account is the result.
import type { FlowRuntime } from '@installer/application/runtime.ts'
import { signInNewAccount } from '@installer/application/sign-in.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { Flow } from '@installer/flows/flow.ts'
import type { SignInFlowInput, SignInState } from '@installer/flows/types.ts'
import { pipeline } from '@installer/pipeline/pipeline.ts'
import type { Step } from '@installer/pipeline/types.ts'

export const SIGN_IN = 'signIn'

const signInStep = (
  runtime: FlowRuntime,
  rememberPassword: boolean
): Step<SignInState> => ({
  id: 'sign-in',
  labelKey: StepLabel.signIn,
  weight: StepWeight.appleRequest,
  run: async (state, context) => ({
    account: await signInNewAccount(
      runtime.deps,
      context,
      state.appleId,
      rememberPassword
    )
  })
})

export const signInFlow = (
  runtime: FlowRuntime,
  input: SignInFlowInput
): Flow<SignInState> => ({
  initial: { appleId: input.appleId },
  pipeline: pipeline<SignInState>(SIGN_IN, [
    signInStep(runtime, input.rememberPassword ?? false)
  ])
})

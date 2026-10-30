// pairByCode: pairs an Apple TV or Vision Pro showing its pairing screen. The code it shows is asked through a
// prompt once it shows it; a wrong code is asked again (each try puts a new code on its screen). Too many wrong
// codes, or the pairing screen closed, end the run with that error.
import { ask } from '@installer/application/ask.ts'
import type { FlowRuntime } from '@installer/application/runtime.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { PromptKind } from '@installer/domain/prompts.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { Flow } from '@installer/flows/flow.ts'
import type {
  PairByCodeInput,
  PairByCodeState
} from '@installer/flows/types.ts'
import { pipeline } from '@installer/pipeline/pipeline.ts'
import type { Step } from '@installer/pipeline/types.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export const PAIR_BY_CODE = 'pairByCode'

/** Apple TV and Vision Pro show 6 digits. */
const CODE_LENGTH = 6

const isWrongCode = (error: unknown): boolean =>
  error instanceof IPAForgeError && error.code === ErrorCode.PairingCodeWrong

const pairStep = (runtime: FlowRuntime): Step<PairByCodeState> => ({
  id: 'pair-by-code',
  labelKey: StepLabel.pairByCode,
  weight: StepWeight.pairing,
  run: async (state, context) => {
    let retry = false
    for (;;) {
      try {
        const paired = await runtime.deps.devices.pairByCode(state.target, () =>
          ask(context, PromptKind.PairingCode, {
            deviceName: state.target.name,
            codeLength: CODE_LENGTH,
            retry
          })
        )

        return { paired }
      } catch (error) {
        if (!isWrongCode(error)) throw error
        retry = true
      }
    }
  }
})

export const pairByCodeFlow = (
  runtime: FlowRuntime,
  input: PairByCodeInput
): Flow<PairByCodeState> => ({
  initial: { target: input.target },
  pipeline: pipeline<PairByCodeState>(PAIR_BY_CODE, [pairStep(runtime)])
})

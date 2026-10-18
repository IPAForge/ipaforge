// The context handed to a running step: cancellation, progress and detail reporting, and prompts.

import { clampFraction } from '@installer/pipeline/progress.ts'
import { stepWeight } from '@installer/pipeline/step.ts'
import type {
  PromptRequest,
  Step,
  StepContext,
  StepContextDeps
} from '@installer/pipeline/types.ts'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const reportProgress =
  <S>(
    step: Step<S>,
    { emit, progress }: StepContextDeps
  ): StepContext['progress'] =>
  (fraction, detail) => {
    const clamped = clampFraction(fraction)
    emit(
      compact({
        type: 'step-progress' as const,
        stepId: step.id,
        fraction: clamped,
        detail
      })
    )
    emit({
      type: 'progress',
      fraction: progress.within(stepWeight(step), clamped)
    })
  }

const reportDetail =
  <S>(step: Step<S>, { emit }: StepContextDeps): StepContext['detail'] =>
  (detail) =>
    emit({ type: 'step-detail', stepId: step.id, detail })

const askUser =
  ({ signal, onPrompt }: StepContextDeps) =>
  async <T>(request: PromptRequest): Promise<T> => {
    if (!onPrompt) {
      throw new IPAForgeError(ErrorCode.PromptCancelled, {
        message: `no prompt handler for ${request.kind}`
      })
    }
    return (await onPrompt(request, signal)) as T
  }

export const createStepContext = <S>(
  step: Step<S>,
  deps: StepContextDeps
): StepContext => ({
  signal: deps.signal,
  progress: reportProgress(step, deps),
  detail: reportDetail(step, deps),
  prompt: askUser(deps)
})

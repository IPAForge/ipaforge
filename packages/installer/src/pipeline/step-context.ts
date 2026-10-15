// The context handed to a running step: cancellation, progress reporting and prompts.
import type { EmitEvent } from '@installer/pipeline/events.ts'
import {
  clampFraction,
  type ProgressTracker
} from '@installer/pipeline/progress.ts'
import {
  type PromptRequest,
  type Step,
  type StepContext,
  stepWeight
} from '@installer/pipeline/step.ts'
import { compact, ErrorCode, LoadstarError } from '@loadstar/kernel'

export type PromptHandler = (
  request: PromptRequest,
  signal: AbortSignal
) => Promise<unknown>

export type StepContextDeps = {
  readonly signal: AbortSignal
  readonly emit: EmitEvent
  readonly progress: ProgressTracker
  readonly onPrompt: PromptHandler | undefined
}

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

const askUser =
  ({ signal, onPrompt }: StepContextDeps) =>
  async <T>(request: PromptRequest): Promise<T> => {
    if (!onPrompt) {
      throw new LoadstarError(ErrorCode.PromptCancelled, {
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
  prompt: askUser(deps)
})

// The runner: walks the steps in order, merging what each produces into the state, and stops at the first
// cancellation or failure with a checkpoint to resume from.
import { attemptStep } from '@installer/pipeline/attempt-step.ts'
import { asLoadstarError, isAbort } from '@installer/pipeline/errors.ts'
import { createProgress } from '@installer/pipeline/progress.ts'
import { stepWeight } from '@installer/pipeline/step.ts'
import { createStepContext } from '@installer/pipeline/step-context.ts'
import type {
  Checkpoint,
  PipelineDefinition,
  PipelineResult,
  RunOptions,
  Step
} from '@installer/pipeline/types.ts'

const assertResumable = <S>(
  pipelineId: string,
  resume: Checkpoint<S> | undefined
): void => {
  if (resume && resume.pipelineId !== pipelineId) {
    throw new Error(
      `checkpoint belongs to "${resume.pipelineId}", not "${pipelineId}"`
    )
  }
}

export const runPipeline = async <S>(
  { id, steps, totalWeight }: PipelineDefinition<S>,
  initial: S,
  options: RunOptions<S>
): Promise<PipelineResult<S>> => {
  assertResumable(id, options.resume)
  const signal = options.signal ?? new AbortController().signal
  const emit = options.onEvent ?? (() => {})
  const progress = createProgress(totalWeight)
  const completed = new Set(options.resume?.completed ?? [])
  let state: S = options.resume ? options.resume.state : initial

  const checkpoint = (): Checkpoint<S> => ({
    pipelineId: id,
    completed: [...completed],
    state
  })
  const cancelled = (): PipelineResult<S> => ({
    status: 'cancelled',
    checkpoint: checkpoint()
  })

  const failed = (step: Step<S>, error: unknown): PipelineResult<S> => {
    const failure = asLoadstarError(error, step.id)
    emit({ type: 'step-failed', stepId: step.id, error: failure })
    return {
      status: 'failed',
      error: failure,
      failedStep: step.id,
      checkpoint: checkpoint()
    }
  }

  const finish = (
    step: Step<S>,
    type: 'step-skipped' | 'step-completed'
  ): void => {
    completed.add(step.id)
    emit({ type, stepId: step.id })
    emit({ type: 'progress', fraction: progress.complete(stepWeight(step)) })
  }

  /** Runs one step to completion; returns a result only when the run must stop there. */
  const execute = async (
    step: Step<S>,
    index: number
  ): Promise<PipelineResult<S> | undefined> => {
    emit({
      type: 'step-started',
      stepId: step.id,
      labelKey: step.labelKey,
      index,
      total: steps.length
    })
    const context = createStepContext(step, {
      signal,
      emit,
      progress,
      onPrompt: options.onPrompt
    })
    try {
      const produced = await attemptStep(step, state, context, {
        emit,
        attempts: options.attempts,
        sleep: options.sleep
      })
      if (produced) state = { ...state, ...produced }
    } catch (error) {
      return isAbort(error, signal) ? cancelled() : failed(step, error)
    }
    finish(step, 'step-completed')
    return undefined
  }

  emit({
    type: 'run-started',
    pipelineId: id,
    steps: steps.map((step) => ({ stepId: step.id, labelKey: step.labelKey })),
    completed: [...completed],
    fraction: progress.complete(
      steps
        .filter((step) => completed.has(step.id))
        .reduce((sum, step) => sum + stepWeight(step), 0)
    )
  })

  for (const [index, step] of steps.entries()) {
    if (completed.has(step.id)) continue
    if (signal.aborted) return cancelled()
    if (step.skip?.(state)) {
      finish(step, 'step-skipped')
      continue
    }
    const stopped = await execute(step, index)
    if (stopped) return stopped
  }
  return { status: 'completed', state }
}

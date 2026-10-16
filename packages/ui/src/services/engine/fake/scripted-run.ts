// A run handle like the Engine's, over a scripted list of steps: the same events in the same order (run-started,
// step-started, progress, prompts, completed/skipped/failed), prompts answered through the handle, cancellation
// and resume from a checkpoint. It stands in for the installer's pipeline in the fake Engine.
import { ErrorCode, LoadstarError } from '@loadstar/kernel'
import type {
  CommandOptions,
  PipelineResult,
  PromptRequest,
  RunEvent,
  RunHandle
} from '@loadstar/rpc'

export type ScriptedStepContext = {
  readonly signal: AbortSignal
  /** Reports progress within the step, then waits one tick. */
  progress(
    fraction: number,
    detail?: Readonly<Record<string, unknown>>
  ): Promise<void>
  prompt<T>(request: PromptRequest): Promise<T>
  /** Reports an automatic retry, then waits its delay. */
  retrying(attempt: number, delayMs: number, code: string): Promise<void>
}

export type ScriptedStep<S> = {
  readonly stepId: string
  readonly labelKey: string
  readonly weight?: number
  readonly skip?: (state: S) => boolean
  run(state: S, context: ScriptedStepContext): Promise<Partial<S> | undefined>
}

export type ScriptedRun<S> = {
  readonly pipelineId: string
  readonly steps: readonly ScriptedStep<S>[]
  readonly initial: S
  readonly options?: CommandOptions<S> | undefined
  /** Pause between events; 0 in tests. */
  readonly delayMs: number
}

type Waiting = {
  readonly request: PromptRequest
  readonly resolve: (answer: unknown) => void
  readonly reject: (error: unknown) => void
}

const weightOf = <S>(step: ScriptedStep<S>) => step.weight ?? 1

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true }
    )
  })

const createEvents = () => {
  const history: RunEvent[] = []
  const listeners = new Set<(event: RunEvent) => void>()

  return {
    emit: (event: RunEvent) => {
      history.push(event)
      for (const listener of [...listeners]) listener(event)
    },
    subscribe: (listener: (event: RunEvent) => void) => {
      for (const event of history) listener(event)
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}

const createPrompts = (emit: (event: RunEvent) => void) => {
  let waiting: Waiting | undefined

  const take = (): Waiting => {
    const current = waiting
    if (!current)
      throw new LoadstarError(ErrorCode.Unexpected, {
        message: 'no prompt is waiting'
      })
    waiting = undefined
    return current
  }

  return {
    ask: (request: PromptRequest, signal: AbortSignal) =>
      new Promise<unknown>((resolve, reject) => {
        waiting = { request, resolve, reject }
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true
        })
        emit({ type: 'prompt', request })
      }),
    pending: () => waiting?.request,
    answer: (answer: unknown) => take().resolve(answer),
    decline: () => take().reject(new LoadstarError(ErrorCode.PromptCancelled))
  }
}

const asError = (error: unknown): LoadstarError =>
  error instanceof LoadstarError
    ? error
    : new LoadstarError(ErrorCode.Unexpected, { cause: error })

export const startScriptedRun = <S>({
  pipelineId,
  steps,
  initial,
  options = {},
  delayMs
}: ScriptedRun<S>): RunHandle<S> => {
  const controller = new AbortController()
  options.signal?.addEventListener('abort', () => controller.abort(), {
    once: true
  })
  const { signal } = controller
  const events = createEvents()
  const prompts = createPrompts(events.emit)
  const total = steps.reduce((sum, step) => sum + weightOf(step), 0) || 1
  const completed = new Set(options.resume?.completed ?? [])
  let state = options.resume ? options.resume.state : initial
  let done = steps
    .filter((step) => completed.has(step.stepId))
    .reduce((sum, step) => sum + weightOf(step), 0)

  const checkpoint = () => ({
    pipelineId,
    completed: [...completed],
    state
  })

  const contextFor = (step: ScriptedStep<S>): ScriptedStepContext => ({
    signal,
    progress: async (fraction, detail) => {
      events.emit({
        type: 'step-progress',
        stepId: step.stepId,
        fraction,
        ...(detail ? { detail } : {})
      })
      events.emit({
        type: 'progress',
        fraction: (done + weightOf(step) * fraction) / total
      })
      await sleep(delayMs, signal)
    },
    prompt: async <T>(request: PromptRequest) =>
      (await prompts.ask(request, signal)) as T,
    retrying: async (attempt, retryDelayMs, code) => {
      events.emit({
        type: 'step-retrying',
        stepId: step.stepId,
        attempt,
        delayMs: retryDelayMs,
        code
      })
      await sleep(delayMs * 4, signal)
    }
  })

  const finish = (
    step: ScriptedStep<S>,
    type: 'step-completed' | 'step-skipped'
  ) => {
    completed.add(step.stepId)
    done += weightOf(step)
    events.emit({ type, stepId: step.stepId })
    events.emit({ type: 'progress', fraction: done / total })
  }

  const runStep = async (
    step: ScriptedStep<S>,
    index: number
  ): Promise<PipelineResult<S> | undefined> => {
    events.emit({
      type: 'step-started',
      stepId: step.stepId,
      labelKey: step.labelKey,
      index,
      total: steps.length
    })
    try {
      await sleep(delayMs, signal)
      const produced = await step.run(state, contextFor(step))
      if (produced) state = { ...state, ...produced }
    } catch (error) {
      if (signal.aborted)
        return { status: 'cancelled', checkpoint: checkpoint() }
      const failure = asError(error)
      events.emit({ type: 'step-failed', stepId: step.stepId, error: failure })
      return {
        status: 'failed',
        error: failure,
        failedStep: step.stepId,
        checkpoint: checkpoint()
      }
    }
    finish(step, 'step-completed')
    return undefined
  }

  const run = async (): Promise<PipelineResult<S>> => {
    // Like the Engine, the first event comes after the caller could subscribe.
    await Promise.resolve()
    events.emit({
      type: 'run-started',
      pipelineId,
      steps: steps.map(({ stepId, labelKey }) => ({ stepId, labelKey })),
      completed: [...completed],
      fraction: done / total
    })
    for (const [index, step] of steps.entries()) {
      if (completed.has(step.stepId)) continue
      if (signal.aborted)
        return { status: 'cancelled', checkpoint: checkpoint() }
      if (step.skip?.(state)) {
        finish(step, 'step-skipped')
        continue
      }
      const stopped = await runStep(step, index)
      if (stopped) return stopped
    }
    return { status: 'completed', state }
  }

  return {
    subscribe: events.subscribe,
    pending: prompts.pending,
    answer: prompts.answer,
    decline: prompts.decline,
    cancel: () => controller.abort(),
    result: run()
  }
}

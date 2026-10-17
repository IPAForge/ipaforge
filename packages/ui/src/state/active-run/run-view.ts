// A run's events reduced into what the run view shows: every step with its label key, state, progress and detail,
// the overall progress, the question waiting for an answer, and how the run ended. All progress comes from the
// Engine's events; nothing here invents it.
import { ErrorCode, type LoadstarError } from '@loadstar/kernel'
import type {
  PromptRequest,
  RemoteCheckpoint,
  RemoteResult,
  RunEvent
} from '@loadstar/rpc'

export type StepState =
  | 'pending'
  | 'active'
  | 'waiting'
  | 'done'
  | 'skipped'
  | 'failed'

export type StepDetail =
  | {
      readonly kind: 'bytes'
      readonly received: number
      readonly total?: number | undefined
    }
  | {
      readonly kind: 'retrying'
      readonly attempt: number
      readonly delayMs: number
    }

export type StepView = {
  readonly id: string
  readonly labelKey: string
  readonly state: StepState
  /** 0–1, within the step. */
  readonly fraction: number
  readonly detail?: StepDetail | undefined
}

export type RunStatus =
  | 'starting'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type RunFailure = {
  readonly error: LoadstarError
  readonly stepId: string
}

export type RunView = {
  readonly status: RunStatus
  readonly steps: readonly StepView[]
  /** 0–1, overall, from the Engine's `progress` events. */
  readonly fraction: number
  readonly prompt?: PromptRequest | undefined
  /** Counts the questions asked, so the same question asked again (a wrong code) gets a fresh dialog. */
  readonly promptCount?: number | undefined
  readonly failure?: RunFailure | undefined
  /** Where a failed or cancelled run continues from. */
  readonly checkpoint?: RemoteCheckpoint | undefined
}

/** A new run, or one resuming: the earlier run's steps stay on screen until the Engine lists them again. */
export const startingView = (previous?: RunView): RunView => ({
  status: 'starting',
  steps: previous?.steps ?? [],
  fraction: previous?.fraction ?? 0
})

const isFinished = (state: StepState) => state === 'done' || state === 'skipped'

const updateStep = (
  view: RunView,
  id: string,
  patch: (step: StepView) => Partial<StepView>
): RunView => ({
  ...view,
  steps: view.steps.map((step) =>
    step.id === id ? { ...step, ...patch(step) } : step
  )
})

const withStepsIn = (
  view: RunView,
  from: readonly StepState[],
  to: StepState
): RunView => ({
  ...view,
  steps: view.steps.map((step) =>
    from.includes(step.state) ? { ...step, state: to } : step
  )
})

const bytesDetail = (
  detail: Readonly<Record<string, unknown>> | undefined
): StepDetail | undefined => {
  const received = detail?.received
  const total = detail?.total
  if (typeof received !== 'number') return undefined
  return {
    kind: 'bytes',
    received,
    total: typeof total === 'number' ? total : undefined
  }
}

type Started = Extract<RunEvent, { type: 'run-started' }>

/** Steps a resumed run already finished keep how they finished (done or skipped) and their detail. */
const plannedSteps = (view: RunView, event: Started): StepView[] =>
  event.steps.map(({ stepId, labelKey }) => {
    const earlier = view.steps.find((step) => step.id === stepId)
    if (!event.completed.includes(stepId))
      return { id: stepId, labelKey, state: 'pending', fraction: 0 }
    return {
      id: stepId,
      labelKey,
      state: earlier && isFinished(earlier.state) ? earlier.state : 'done',
      fraction: 1,
      detail: earlier?.detail
    }
  })

export const reduceRunEvent = (view: RunView, event: RunEvent): RunView => {
  switch (event.type) {
    case 'run-started':
      return {
        status: 'running',
        steps: plannedSteps(view, event),
        fraction: event.fraction
      }
    case 'step-started':
      return updateStep(view, event.stepId, () => ({
        state: 'active',
        fraction: 0,
        detail: undefined
      }))
    case 'step-progress':
      return updateStep(view, event.stepId, (step) => ({
        fraction: event.fraction,
        detail: bytesDetail(event.detail) ?? step.detail
      }))
    case 'step-retrying':
      return updateStep(view, event.stepId, () => ({
        fraction: 0,
        detail: {
          kind: 'retrying',
          attempt: event.attempt,
          delayMs: event.delayMs
        }
      }))
    case 'step-skipped':
      return updateStep(view, event.stepId, () => ({ state: 'skipped' }))
    case 'step-completed':
      return updateStep(view, event.stepId, (step) => ({
        state: 'done',
        fraction: 1,
        detail: step.detail?.kind === 'bytes' ? step.detail : undefined
      }))
    case 'step-failed':
      return updateStep(view, event.stepId, () => ({ state: 'failed' }))
    case 'progress':
      return { ...view, fraction: event.fraction }
    case 'prompt':
      return {
        ...withStepsIn(view, ['active'], 'waiting'),
        status: 'waiting',
        prompt: event.request,
        promptCount: (view.promptCount ?? 0) + 1
      }
  }
}

/** The answer went to the Engine: the step it waited on is running again. */
export const answeredView = (view: RunView): RunView => ({
  ...withStepsIn(view, ['waiting'], 'active'),
  status: 'running',
  prompt: undefined
})

const stoppedView = (view: RunView, checkpoint: RemoteCheckpoint): RunView => ({
  ...withStepsIn(view, ['active', 'waiting', 'failed'], 'pending'),
  status: 'cancelled',
  prompt: undefined,
  checkpoint
})

/** How the run ended. Declining a question stops the run like Cancel does: it can be resumed. */
export const finishedView = (
  view: RunView,
  result: RemoteResult<unknown>
): RunView => {
  if (result.status === 'completed')
    return { ...view, status: 'completed', fraction: 1, prompt: undefined }
  if (
    result.status === 'cancelled' ||
    result.error.code === ErrorCode.PromptCancelled
  )
    return stoppedView(view, result.checkpoint)
  return {
    ...withStepsIn(view, ['active', 'waiting'], 'failed'),
    status: 'failed',
    prompt: undefined,
    failure: { error: result.error, stepId: result.failedStep },
    checkpoint: result.checkpoint
  }
}

/** The run could not start or finish (the channel closed): it fails where it was, without a checkpoint. */
export const brokenView = (view: RunView, error: LoadstarError): RunView => {
  const current =
    view.steps.find((step) => step.state === 'active') ??
    view.steps.find((step) => step.state === 'waiting')

  return {
    ...withStepsIn(view, ['active', 'waiting'], 'failed'),
    status: 'failed',
    prompt: undefined,
    failure: { error, stepId: current?.id ?? '' },
    checkpoint: undefined
  }
}

const PERCENT = 100

/** The overall progress as a whole percentage, for a progress bar's value. */
export const overallPercent = (view: RunView): number =>
  Math.round(view.fraction * PERCENT)

export const isRunActive = (view: RunView | undefined): boolean =>
  view?.status === 'starting' ||
  view?.status === 'running' ||
  view?.status === 'waiting'

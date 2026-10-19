// Step-level changes the run view is built from: patch one step, move every step in some states to another, read
// a download's byte counts, and lay out the steps a run announced.
import type {
  RunStartedEvent,
  RunView,
  StepDetail,
  StepState,
  StepView
} from '@ui/state/active-run/types.ts'

const isFinished = (state: StepState) => state === 'done' || state === 'skipped'

export const updateStep = (
  view: RunView,
  id: string,
  patch: (step: StepView) => Partial<StepView>
): RunView => ({
  ...view,
  steps: view.steps.map((step) =>
    step.id === id ? { ...step, ...patch(step) } : step
  )
})

export const withStepsIn = (
  view: RunView,
  from: readonly StepState[],
  to: StepState
): RunView => ({
  ...view,
  steps: view.steps.map((step) =>
    from.includes(step.state) ? { ...step, state: to } : step
  )
})

const numberOf = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined

/**
 * What a progress update says about its step: requests to Apple while provisioning, bytes moved (a download, or
 * the app sent to the device), or iOS installing the app (its own percent and phase); each with how long it has run.
 */
export const progressDetail = (
  detail: Readonly<Record<string, unknown>> | undefined,
  fraction = 0
): StepDetail | undefined => {
  const elapsedMs = numberOf(detail?.elapsedMs)
  const percent = numberOf(detail?.percent)
  const done = numberOf(detail?.done)
  const total = numberOf(detail?.total)

  if (
    detail?.phase === 'provisioning' &&
    typeof detail.task === 'string' &&
    done !== undefined &&
    total !== undefined
  )
    return {
      kind: 'provisioning',
      task: detail.task,
      done,
      total,
      fraction,
      elapsedMs
    }

  if (detail?.phase === 'installing' && percent !== undefined)
    return {
      kind: 'installing',
      percent,
      status: typeof detail.status === 'string' ? detail.status : undefined,
      elapsedMs
    }

  const received = numberOf(detail?.received)

  if (received === undefined) return undefined

  return { kind: 'bytes', received, total: numberOf(detail?.total), elapsedMs }
}

/** Steps a resumed run already finished keep how they finished (done or skipped) and their detail. */
export const plannedSteps = (
  view: RunView,
  event: RunStartedEvent
): StepView[] =>
  event.steps.map(({ stepId, labelKey }) => {
    const earlier = view.steps.find((step) => step.id === stepId)
    if (!event.completed.includes(stepId))
      return { id: stepId, labelKey, state: 'pending', fraction: 0 }
    return {
      id: stepId,
      labelKey,
      state: earlier && isFinished(earlier.state) ? earlier.state : 'done',
      fraction: 1,
      detail: earlier?.detail,
      report: earlier?.report
    }
  })

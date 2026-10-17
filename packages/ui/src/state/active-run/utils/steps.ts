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

export const bytesDetail = (
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
      detail: earlier?.detail
    }
  })

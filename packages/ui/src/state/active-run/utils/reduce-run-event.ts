// How each of the Engine's run events changes the run view. All progress comes from these events; nothing here
// invents it.
import type { RunEvent } from '@loadstar/rpc'
import type { RunEventHandlers, RunView } from '@ui/state/active-run/types.ts'
import {
  bytesDetail,
  plannedSteps,
  updateStep,
  withStepsIn
} from '@ui/state/active-run/utils/steps.ts'

const runEventHandlers = {
  'run-started': (view, event) => ({
    status: 'running',
    steps: plannedSteps(view, event),
    fraction: event.fraction
  }),
  'step-started': (view, event) =>
    updateStep(view, event.stepId, () => ({
      state: 'active',
      fraction: 0,
      detail: undefined
    })),
  'step-progress': (view, event) =>
    updateStep(view, event.stepId, (step) => ({
      fraction: event.fraction,
      detail: bytesDetail(event.detail) ?? step.detail
    })),
  'step-retrying': (view, event) =>
    updateStep(view, event.stepId, () => ({
      fraction: 0,
      detail: {
        kind: 'retrying',
        attempt: event.attempt,
        delayMs: event.delayMs
      }
    })),
  'step-skipped': (view, event) =>
    updateStep(view, event.stepId, () => ({ state: 'skipped' })),
  'step-completed': (view, event) =>
    updateStep(view, event.stepId, (step) => ({
      state: 'done',
      fraction: 1,
      detail: step.detail?.kind === 'bytes' ? step.detail : undefined
    })),
  'step-failed': (view, event) =>
    updateStep(view, event.stepId, () => ({ state: 'failed' })),
  progress: (view, event) => ({ ...view, fraction: event.fraction }),
  prompt: (view, event) => ({
    ...withStepsIn(view, ['active'], 'waiting'),
    status: 'waiting',
    prompt: event.request,
    promptCount: (view.promptCount ?? 0) + 1
  })
} satisfies RunEventHandlers

/** Any event after an answer means the Engine moved on: the answered question leaves the screen. */
const settleAnswer = (view: RunView): RunView =>
  view.status === 'answering'
    ? { ...view, status: 'running', prompt: undefined }
    : view

/** The view after one more event, through the handler for the event's type. */
export const reduceRunEvent = (view: RunView, event: RunEvent): RunView => {
  const handle = runEventHandlers[event.type] as (
    view: RunView,
    event: RunEvent
  ) => RunView

  return handle(settleAnswer(view), event)
}

import type { ActiveRun } from '@ui/state/active-run/types.ts'

/** The label key of one of the run's steps, when the run has it. */
export const stepLabel = (run: ActiveRun, stepId: string) =>
  run.view.steps.find((step) => step.id === stepId)?.labelKey

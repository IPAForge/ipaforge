// Overall progress: each step owns a share of the bar proportional to its weight.
import { type Step, stepWeight } from '@installer/pipeline/step.ts'

export type ProgressTracker = {
  /** Counts a finished step of `weight`; returns the overall fraction. */
  readonly complete: (weight: number) => number
  /** The overall fraction while the current step of `weight` is `fraction` done. */
  readonly within: (weight: number, fraction: number) => number
}

/** Sum of the step weights, never 0 (an empty pipeline would divide by zero). */
export const totalWeight = <S>(steps: readonly Step<S>[]): number =>
  steps.reduce((sum, step) => sum + stepWeight(step), 0) || 1

export const clampFraction = (fraction: number): number =>
  Math.min(1, Math.max(0, fraction))

export const createProgress = (total: number): ProgressTracker => {
  let done = 0

  return {
    complete: (weight) => {
      done += weight
      return done / total
    },
    within: (weight, fraction) => (done + weight * fraction) / total
  }
}

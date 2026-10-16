// What a running pipeline reports to the UI.
import type { LoadstarError } from '@loadstar/kernel'

/** A step as the run announces it up front, so the UI can list every step before it starts. */
export type PlannedStep = {
  readonly stepId: string
  readonly labelKey: string
}

export type PipelineEvent =
  | {
      /** First event of every run: all its steps, those a resumed run already finished, and the progress so far. */
      readonly type: 'run-started'
      readonly pipelineId: string
      readonly steps: readonly PlannedStep[]
      readonly completed: readonly string[]
      readonly fraction: number
    }
  | {
      readonly type: 'step-started'
      readonly stepId: string
      readonly labelKey: string
      readonly index: number
      readonly total: number
    }
  | {
      readonly type: 'step-progress'
      readonly stepId: string
      readonly fraction: number
      readonly detail?: Readonly<Record<string, unknown>>
    }
  | {
      readonly type: 'step-retrying'
      readonly stepId: string
      readonly attempt: number
      readonly delayMs: number
      readonly code?: string
    }
  | { readonly type: 'step-skipped'; readonly stepId: string }
  | { readonly type: 'step-completed'; readonly stepId: string }
  | {
      readonly type: 'step-failed'
      readonly stepId: string
      readonly error: LoadstarError
    }
  | { readonly type: 'progress'; readonly fraction: number }

export type EmitEvent = (event: PipelineEvent) => void

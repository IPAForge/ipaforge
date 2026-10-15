// How a run ends, and where a later run can pick up from.
import type { LoadstarError } from '@loadstar/kernel'

/** Where to continue after a failure: completed steps are skipped, their state kept. */
export type Checkpoint<S> = {
  readonly pipelineId: string
  readonly completed: readonly string[]
  readonly state: S
}

export type PipelineResult<S> =
  | { readonly status: 'completed'; readonly state: S }
  | {
      readonly status: 'failed'
      readonly error: LoadstarError
      readonly failedStep: string
      readonly checkpoint: Checkpoint<S>
    }
  | { readonly status: 'cancelled'; readonly checkpoint: Checkpoint<S> }

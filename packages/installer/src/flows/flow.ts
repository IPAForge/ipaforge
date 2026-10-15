import type { Pipeline } from '@installer/pipeline/pipeline.ts'

/** A flow assembled for one input: the pipeline to run and the state it starts from. */
export type Flow<S> = {
  readonly pipeline: Pipeline<S>
  readonly initial: S
}

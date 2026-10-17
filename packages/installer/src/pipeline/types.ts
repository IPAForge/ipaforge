import type { ProgressTracker } from '@installer/pipeline/progress.ts'
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

export type RunOptions<S> = {
  readonly onEvent?: (event: PipelineEvent) => void
  readonly onPrompt?: (
    request: PromptRequest,
    signal: AbortSignal
  ) => Promise<unknown>
  readonly signal?: AbortSignal
  /** Continue from an earlier failed or cancelled run of the same pipeline. */
  readonly resume?: Checkpoint<S>
  /** Attempts for idempotent steps on transient errors (default 3). */
  readonly attempts?: number
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

export type PipelineDefinition<S> = {
  readonly id: string
  readonly steps: readonly Step<S>[]
  readonly totalWeight: number
}

export type PromptHandler = (
  request: PromptRequest,
  signal: AbortSignal
) => Promise<unknown>

export type StepContextDeps = {
  readonly signal: AbortSignal
  readonly emit: EmitEvent
  readonly progress: ProgressTracker
  readonly onPrompt: PromptHandler | undefined
}

/** Something the user must answer before a step can continue (2FA code, team choice, certificate to revoke…). */
export type PromptRequest = {
  readonly kind: string
  readonly data?: Readonly<Record<string, unknown>>
}

export type StepContext = {
  readonly signal: AbortSignal
  /** Reports progress within this step, 0–1. */
  progress(fraction: number, detail?: Readonly<Record<string, unknown>>): void
  /** Asks the user; resolves with their answer. Throws `installer.prompt_cancelled` when they decline. */
  prompt<T = unknown>(request: PromptRequest): Promise<T>
}

export type Step<S> = {
  /** Stable id (used for resume and diagnostics). */
  readonly id: string
  /** i18n key for the step's label. */
  readonly labelKey: string
  /** Relative share of the overall progress bar (default 1). */
  readonly weight?: number
  /** Safe to run again after a transient failure (downloads, read-only requests). */
  readonly idempotent?: boolean
  /** Skip the step when this returns true for the current state. */
  readonly skip?: (state: S) => boolean
  /** Returns the state fields it produced (merged into the state). */
  run(state: S, context: StepContext): Promise<Partial<S> | undefined>
}

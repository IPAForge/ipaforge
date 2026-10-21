import type { ProgressTracker } from '@installer/pipeline/progress.ts'
import type { IPAForgeError } from '@ipaforge/kernel'

/** A step as the run announces it up front, so the UI can list every step before it starts. */
export type PlannedStep = {
  readonly stepId: string
  readonly labelKey: string
}

/** What a step did, for the run's step list. */
export type StepDetail =
  | {
      readonly kind: 'device'
      readonly productType: string
      readonly iosVersion: string
      /** How the device is reached: a cable, or Wi-Fi. */
      readonly connection: 'usb' | 'network'
    }
  | {
      readonly kind: 'release'
      readonly version: string
      readonly channel: 'stable' | 'nightly'
    }
  | {
      readonly kind: 'download'
      readonly bytes: number
      readonly cached: boolean
    }
  | {
      readonly kind: 'app'
      readonly name: string
      readonly version?: string
      readonly extensions: number
    }
  | {
      readonly kind: 'session'
      readonly how: 'reused' | 'renewed' | 'signed-in'
    }
  | { readonly kind: 'team'; readonly name: string; readonly isFree: boolean }
  | { readonly kind: 'device-registration'; readonly isNew: boolean }
  /** Save signed .ipa instead: where the signed app was written. */
  | { readonly kind: 'saved'; readonly path: string }
  | {
      readonly kind: 'certificate'
      readonly how: 'reused' | 'created' | 'replaced'
    }
  | {
      readonly kind: 'app-ids'
      readonly created: number
      readonly reused: number
      readonly left: number
    }
  | {
      readonly kind: 'free-apps'
      readonly used: number
      readonly limit: number
      readonly removed?: string
    }
  | { readonly kind: 'profiles'; readonly count: number }
  | {
      readonly kind: 'signed'
      readonly bundles: number
      /** Compressed because the device is on Wi-Fi. */
      readonly compressed: boolean
    }
  | {
      readonly kind: 'install-phase'
      readonly phase: 'uploading' | 'installing'
    }
  | {
      readonly kind: 'pairing'
      readonly apps: readonly string[]
      /** SideStore also got its remote pairing (iOS 17.4 and later). */
      readonly remote?: boolean
    }
  | { readonly kind: 'certificate-shared'; readonly isShared: boolean }

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
  | {
      /** What the step did (the release it picked, the certificate it reused…), once it knows. */
      readonly type: 'step-detail'
      readonly stepId: string
      readonly detail: StepDetail
    }
  | { readonly type: 'step-skipped'; readonly stepId: string }
  | { readonly type: 'step-completed'; readonly stepId: string }
  | {
      readonly type: 'step-failed'
      readonly stepId: string
      readonly error: IPAForgeError
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
      readonly error: IPAForgeError
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
  /** Tells the UI what this step did (`step-detail`). */
  detail(detail: StepDetail): void
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

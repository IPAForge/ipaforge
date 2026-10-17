import type { LoadstarError, Logger } from '@loadstar/kernel'
import type {
  EngineClient,
  PromptRequest,
  RemoteCheckpoint,
  RunEvent
} from '@loadstar/rpc'
import type { InstallSideStoreInput } from '@ui/services/engine/types.ts'

export type StepState =
  | 'pending'
  | 'active'
  | 'waiting'
  | 'done'
  | 'skipped'
  | 'failed'

export type StepDetail =
  | {
      readonly kind: 'bytes'
      readonly received: number
      readonly total?: number | undefined
    }
  | {
      readonly kind: 'retrying'
      readonly attempt: number
      readonly delayMs: number
    }

export type StepView = {
  readonly id: string
  readonly labelKey: string
  readonly state: StepState
  /** 0–1, within the step. */
  readonly fraction: number
  readonly detail?: StepDetail | undefined
}

export type RunStatus =
  | 'starting'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type RunFailure = {
  readonly error: LoadstarError
  readonly stepId: string
}

export type RunView = {
  readonly status: RunStatus
  readonly steps: readonly StepView[]
  /** 0–1, overall, from the Engine's `progress` events. */
  readonly fraction: number
  readonly prompt?: PromptRequest | undefined
  /** Counts the questions asked, so the same question asked again (a wrong code) gets a fresh dialog. */
  readonly promptCount?: number | undefined
  readonly failure?: RunFailure | undefined
  /** Where a failed or cancelled run continues from. */
  readonly checkpoint?: RemoteCheckpoint | undefined
}

export type RunStartedEvent = Extract<RunEvent, { type: 'run-started' }>

/** One handler per Engine event type, each given the event of its own type. */
export type RunEventHandlers = {
  readonly [Type in RunEvent['type']]: (
    view: RunView,
    event: Extract<RunEvent, { type: Type }>
  ) => RunView
}

export type ActiveRun = {
  readonly input: InstallSideStoreInput
  readonly view: RunView
}

export type ActiveRunStore = {
  getState: () => ActiveRun | undefined
  subscribe: (listener: () => void) => () => void
  start: (input: InstallSideStoreInput) => void
  /** Continues a failed or cancelled run from its checkpoint. */
  resume: () => void
  /** Starts again with part of the input changed; finished steps that do not depend on it run quickly again. */
  restart: (patch: Partial<InstallSideStoreInput>) => void
  answer: (answer: unknown) => void
  decline: () => void
  cancel: () => void
  /** Forgets a run that has ended. */
  dismiss: () => void
}

export type ActiveRunStoreOptions = {
  readonly engine: EngineClient
  readonly logger: Logger
  /** Called when a run ends, however it ends (e.g. to refresh accounts the run changed). */
  readonly onSettled?: () => void
}

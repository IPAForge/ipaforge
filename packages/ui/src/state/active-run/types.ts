import type { IPAForgeError, Logger } from '@ipaforge/kernel'
import type {
  EngineClient,
  PromptRequest,
  RemoteCheckpoint,
  RunEvent,
  StepDetail as StepReport
} from '@ipaforge/rpc'
import type {
  AppSource,
  Channel,
  InstallAppsInput,
  InstallSideStoreInput
} from '@ui/services/engine/types.ts'

export type StepState =
  | 'pending'
  | 'active'
  | 'waiting'
  | 'done'
  | 'skipped'
  | 'failed'

export type StepDetail =
  | {
      /** Downloading, or sending the app to the device. */
      readonly kind: 'bytes'
      readonly received: number
      readonly total?: number | undefined
      /** How long this transfer has run, for the speed and the time left. */
      readonly elapsedMs?: number | undefined
    }
  | {
      /** Provisioning: which requests to Apple (the team, App IDs, the app group, profiles), and how many are done. */
      readonly kind: 'provisioning'
      readonly task: string
      readonly done: number
      readonly total: number
      readonly fraction: number
      readonly elapsedMs?: number | undefined
    }
  | {
      /** iOS installing the app: its own percent and phase (`VerifyingApplication`…). */
      readonly kind: 'installing'
      readonly percent: number
      readonly status?: string | undefined
      readonly elapsedMs?: number | undefined
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
  /** What the step did, as the Engine reported it ("SideStore 0.7.0", "Saved session reused"). */
  readonly report?: StepReport | undefined
}

export type RunStatus =
  | 'starting'
  | 'running'
  | 'waiting'
  /** The answer went to the Engine; its question stays on screen, busy, until the next event. */
  | 'answering'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type RunFailure = {
  readonly error: IPAForgeError
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

/** An app an apps run installs, as the preload list showed it (the Engine only knows where it is). */
export type RunApp = {
  readonly name: string
  readonly version?: string | undefined
  readonly source: AppSource
  /** Save signed .ipa instead: signed and saved on the computer, not installed. */
  readonly save?: boolean | undefined
  /** Refresh: a new profile only, or why the app is installed again. */
  readonly refresh?: RefreshKind | undefined
}

/**
 * How a refresh treats an app: a new profile only, or installed again (its certificate changed, it isn't marked,
 * or it is SideStore, so its own screen shows the new date).
 */
export type RefreshKind = 'profile' | 'certificate' | 'unmarked' | 'sidestore'

/** What Repair SideStore fixes: SideStore as installed, installed again, a new profile, the pairing file. */
export type RepairOptions = {
  readonly bundleId: string
  readonly reinstall: boolean
  readonly profile: boolean
  readonly pairing: boolean
}

/** How an apps run started from the Apps page differs from a Preload one. */
export type AppsRunOptions = {
  /** Refresh: installed apps (bundle ids) that get new profiles only, listed after `input.apps` in `apps`. */
  readonly profiles?: readonly string[] | undefined
  /** Started from the Apps page (or by automatic refresh), so a failure is shown there too. */
  readonly fromApps?: boolean | undefined
}

/** What a run was asked to do: SideStore (the Install page) or a list of apps (the Preload page). */
export type RunRequest =
  | {
      readonly kind: 'sidestore'
      readonly input: InstallSideStoreInput
      /** Repair SideStore: the fixes to run instead of a fresh install (Install shows the run the same way). */
      readonly repair?: RepairOptions | undefined
    }
  | ({
      readonly kind: 'apps'
      readonly input: InstallAppsInput
      readonly apps: readonly RunApp[]
    } & AppsRunOptions)

export type RunKind = RunRequest['kind']

/** The install run: one at a time, since it holds the device. */
export type ActiveRun = RunRequest & {
  readonly view: RunView
  /** ISO times the run (with any resumes) started and ended, for its lines in the log viewer. */
  readonly startedAt: string
  readonly endedAt?: string | undefined
}

/** A SideStore run, as the Install page shows it. */
export type SideStoreRun = Extract<ActiveRun, { kind: 'sidestore' }>

/** What starting again may change: the Apple ID, and for SideStore the channel. */
export type RestartPatch = {
  readonly accountId?: string
  readonly channel?: Channel
  /** Create App IDs though Apple's (negative) count says none are left. */
  readonly tryAnyway?: boolean
}

export type ActiveRunStore = {
  getState: () => ActiveRun | undefined
  subscribe: (listener: () => void) => () => void
  start: (input: InstallSideStoreInput) => void
  /** Repairs SideStore: the fixes in one run, shown like a SideStore install. */
  startRepair: (input: InstallSideStoreInput, repair: RepairOptions) => void
  /** Installs the apps of the preload list in one run. */
  startApps: (
    input: InstallAppsInput,
    apps: readonly RunApp[],
    options?: AppsRunOptions
  ) => void
  /** Continues a failed or cancelled run from its checkpoint. */
  resume: () => void
  /** Starts again with part of the input changed; finished steps that do not depend on it run quickly again. */
  restart: (patch: RestartPatch) => void
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

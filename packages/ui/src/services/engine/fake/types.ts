import type { ErrorCode } from '@ipaforge/kernel'
import type {
  CommandOptions,
  DeviceWatchEvent,
  PromptRequest,
  StepDetail as StepReport
} from '@ipaforge/rpc'
import type { fakeScenarioIds } from '@ui/services/engine/fake/fake-scenarios.ts'
import type { Account, Device, DeviceCheck } from '@ui/services/engine/types.ts'

export type FakeDeviceState = {
  readonly check: DeviceCheck
  trusted: boolean
  /** Status reads left before the user "unlocks" it. */
  locksFor: number
}

export type FakeDeviceStates = {
  status: (udid: string) => Promise<DeviceCheck>
  pair: (udid: string) => Promise<DeviceCheck>
}

export type DeviceFeedListener = (event: DeviceWatchEvent) => void

export type FakeDeviceFeed = {
  list: () => Device[]
  watch: (listener: DeviceFeedListener, signal?: AbortSignal) => () => void
  plugIn: (device: Device) => void
  unplug: (udid: string) => void
}

export type FakeEngineOptions = {
  readonly scenario?: FakeScenarioId
  /** Connected devices; tests keep it to plug devices in and out. */
  readonly devices?: FakeDeviceFeed
  /** Pause between run events, so a run can be watched; 0 in tests. */
  readonly delayMs?: number
  /** How long Apple takes to answer a sign-in request, so the dev host shows the waiting states. */
  readonly appleDelayMs?: number
  /** Replaces that wait (tests hold Apple's answer until they release it). */
  readonly appleAnswer?: () => Promise<void>
}

export type TeamQuery = { readonly accountId: string; readonly teamId?: string }

export type FakeSignInState = {
  readonly appleId: string
  readonly account?: Account
}

export type FakeInstallState = {
  readonly udid: string
  readonly accountId: string
  readonly teamId?: string
  readonly isFreeTeam?: boolean
}

export type StepBody = (
  state: FakeInstallState,
  context: ScriptedStepContext
) => Promise<Partial<FakeInstallState> | undefined>

export type FakeScenarioId = (typeof fakeScenarioIds)[number]

export type FakeFailure = {
  readonly stepId: string
  readonly code: ErrorCode
}

export type ScriptedStepContext = {
  readonly signal: AbortSignal
  /** Reports progress within the step, then waits one tick. */
  progress(
    fraction: number,
    detail?: Readonly<Record<string, unknown>>
  ): Promise<void>
  prompt<T>(request: PromptRequest): Promise<T>
  /** Reports what the step did, as the Engine's steps do. */
  detail(report: StepReport): void
  /** Reports an automatic retry, then waits its delay. */
  retrying(attempt: number, delayMs: number, code: string): Promise<void>
}

export type ScriptedStep<S> = {
  readonly stepId: string
  readonly labelKey: string
  readonly weight?: number
  readonly skip?: (state: S) => boolean
  run(state: S, context: ScriptedStepContext): Promise<Partial<S> | undefined>
}

export type ScriptedRun<S> = {
  readonly pipelineId: string
  readonly steps: readonly ScriptedStep<S>[]
  readonly initial: S
  readonly options?: CommandOptions<S> | undefined
  /** Pause between events; 0 in tests. */
  readonly delayMs: number
}

export type PendingPrompt = {
  readonly request: PromptRequest
  readonly resolve: (answer: unknown) => void
  readonly reject: (error: unknown) => void
}

/** An app the fake Engine installs from the Preload page. */
export type FakeApp = {
  readonly name: string
  readonly version: string
  readonly extensions: number
  readonly isCatalog: boolean
  /** On the device already, in this version. */
  readonly installedVersion?: string | undefined
  /** The device's iOS is too old for it. */
  readonly needsIos?: string | undefined
}

/** An app source as the fake Engine gets it: a catalog app, or a file the rpc server already opened. */
export type FakeAppSource =
  | { readonly kind: 'catalog'; readonly appId: string }
  | { readonly kind: 'file'; readonly file: { readonly name: string } }

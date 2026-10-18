import type { FreeSlots } from '@installer/application/types.ts'
import type { AppSource } from '@installer/domain/types.ts'
import type {
  Checkpoint,
  PipelineEvent,
  PipelineResult,
  PromptHandler,
  PromptRequest
} from '@installer/pipeline/types.ts'
import type {
  AppId,
  AppIdPlan,
  AppIdQuota,
  DevelopmentCertificate,
  SavedAccount,
  Team
} from '@ipaforge/apple'
import type { CatalogApp, Channel } from '@ipaforge/catalog'
import type { DeviceCheck, UsbmuxDevice } from '@ipaforge/device'
import type {
  CompatibilityProblem,
  IpaInspection,
  SideloadIdentityPlan
} from '@ipaforge/signer'

export type PlanInstallInput = {
  readonly udid: string
  readonly accountId: string
  readonly teamId?: string
  readonly source: AppSource
}

export type CertificateStatus = {
  /** A certificate and key from an earlier run are stored for this team. */
  readonly stored: boolean
  /** …and Apple still lists that certificate, so it would be reused. */
  readonly reusable: boolean
  /** iOS development certificates on the team (any tool's). */
  readonly onTeam: number
}

export type InstallPlan = {
  readonly team: Team
  readonly inspection: IpaInspection
  /** Why the device cannot run the app (the error installing would stop with); absent when it can. */
  readonly compatibility?: CompatibilityProblem
  readonly identity: SideloadIdentityPlan
  /** The version on the device now, when the app is already installed: installing updates it and keeps its data. */
  readonly installedVersion?: string
  readonly appIds: AppIdPlan
  /** Free teams only: the apps holding a slot (the app itself left out) and the limit. */
  readonly freeSlots?: {
    readonly occupied: FreeSlots['occupied']
    readonly limit: number
  }
  readonly certificate: CertificateStatus
  /** The app holds a SideStore that would receive the signing certificate (after the user agrees, for a file). */
  readonly sharesCertificate: boolean
}

export type Pending = {
  readonly request: PromptRequest
  readonly resolve: (answer: unknown) => void
  readonly reject: (error: unknown) => void
}

export type PromptQueue = {
  /** The prompt handler for the pipeline; `onAsked` announces each question. */
  readonly ask: (
    request: PromptRequest,
    signal: AbortSignal
  ) => Promise<unknown>
  readonly pending: () => PromptRequest | undefined
  readonly answer: (answer: unknown) => void
  readonly decline: () => void
}

export type TeamQuery = {
  readonly accountId: string
  /** Default: the team remembered for the account, or its only team. */
  readonly teamId?: string
}

export type AppIdUsage = {
  readonly team: Team
  readonly appIds: readonly AppId[]
  readonly quota: AppIdQuota
}

export type TeamCertificates = {
  readonly team: Team
  readonly certificates: readonly DevelopmentCertificate[]
}

export type EngineQueries = {
  listDevices(): Promise<UsbmuxDevice[]>
  /** Lock state, Developer Mode and iOS version of a paired device. */
  deviceStatus(udid: string): Promise<DeviceCheck>
  /**
   * Pairs with the device when it doesn't trust this computer yet (the Trust prompt shows on the device and this
   * waits for the tap), then reads its status like `deviceStatus`.
   */
  pairDevice(udid: string): Promise<DeviceCheck>
  listAccounts(): Promise<SavedAccount[]>
  /** False when saved Apple IDs last only until the app quits: no OS keychain, or access to it was denied. */
  canSaveAccounts(): Promise<boolean>
  listTeams(accountId: string): Promise<Team[]>
  catalogApps(): Promise<readonly CatalogApp[]>
  recommendedChannel(appId: string, iosVersion?: string): Promise<Channel>
  appIdQuota(query: TeamQuery): Promise<AppIdUsage>
  listCertificates(query: TeamQuery): Promise<TeamCertificates>
  /** Read-only preview of installing one app (identity, App ID budget, free-app slots, certificate). */
  planInstall(input: PlanInstallInput): Promise<InstallPlan>
}

export type RunEvent =
  | PipelineEvent
  | { readonly type: 'prompt'; readonly request: PromptRequest }

export type CommandOptions<S> = {
  /** Answers prompts directly; without it they arrive as `prompt` events and are answered through the handle. */
  readonly onPrompt?: PromptHandler
  /** Continue a failed or cancelled run of the same command from its checkpoint. */
  readonly resume?: Checkpoint<S>
  readonly signal?: AbortSignal
}

export type RunHandle<S> = {
  /** Every event so far, then each new one; returns an unsubscribe function. */
  subscribe(listener: (event: RunEvent) => void): () => void
  /** The question waiting for an answer (when no `onPrompt` was given). */
  pending(): PromptRequest | undefined
  answer(answer: unknown): void
  /** Declines the waiting question (`installer.prompt_cancelled`). */
  decline(): void
  cancel(): void
  /** Settles when the run ends; a failed or cancelled result carries the checkpoint to resume from. */
  readonly result: Promise<PipelineResult<S>>
}

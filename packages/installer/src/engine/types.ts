import type { CatalogRelease } from '@installer/application/catalog-releases.ts'
import type { DeviceApps } from '@installer/application/device-apps.ts'
import type { CheckSideStoreQuery } from '@installer/application/installed/check-sidestore.ts'
import type { RefreshPlanQuery } from '@installer/application/installed/refresh-plan.ts'
import type { FreeSlots } from '@installer/application/types.ts'
import type {
  AppSource,
  ClassicPairingState,
  InstalledApp,
  RefreshDecision,
  RemotePairingFileState,
  SideStoreCheck
} from '@installer/domain/types.ts'
import type {
  Checkpoint,
  PipelineEvent,
  PipelineResult,
  PromptHandler,
  PromptRequest
} from '@installer/pipeline/types.ts'
import type {
  AnisetteChoice,
  AnisetteOverview,
  AnisetteServerInput,
  AnisetteServerTest,
  AppGroup,
  AppId,
  AppIdPlan,
  AppIdQuota,
  DevelopmentCertificate,
  RegisteredDevice,
  SavedAccount,
  Team
} from '@ipaforge/apple'
import type {
  CatalogApp,
  Channel,
  SourceApps,
  SourceInfo,
  SourcePreview
} from '@ipaforge/catalog'
import type {
  CodePairedDevice,
  DeviceCheck,
  PairableEvent,
  UsbmuxDevice
} from '@ipaforge/device'
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

/** The setup guide's check of this computer. */
export type SystemCheck = {
  /** The system service that talks to iPhones: answering, not installed or not running, or failing otherwise. */
  readonly deviceService: 'ok' | 'missing' | 'failed'
  /** Apple's servers answer. */
  readonly apple: boolean
  /** This computer's clock is close enough to Apple's for sign-in. */
  readonly clockOk: boolean
  /** Apple's clock minus this computer's, when Apple answered. */
  readonly clockSkewSeconds?: number
  /**
   * The anisette servers sign-in tries first, in its order: the first that answered (the one sign-in would use)
   * and how many were asked.
   */
  readonly anisette: { readonly server?: string; readonly tried: number }
}

export type TeamCertificates = {
  readonly team: Team
  readonly certificates: readonly DevelopmentCertificate[]
  /** The serial of the one this computer keeps, with its key (it signs installs here). */
  readonly storedSerial?: string
}

export type TeamAppGroups = {
  readonly team: Team
  readonly groups: readonly AppGroup[]
}

export type TeamDevices = {
  readonly team: Team
  readonly devices: readonly RegisteredDevice[]
}

/** A provisioning profile on a device, and whether an installed app (or one of its extensions) uses it. */
export type DeviceProfileInfo = {
  readonly uuid: string
  readonly name: string
  readonly teamId?: string
  /** The bundle id it's for; absent for a wildcard profile. */
  readonly bundleId?: string
  readonly expiresAt?: Date
  readonly isUsed: boolean
}

/** What the search for Apple TVs and Vision Pros showing their pairing screen reports, and when it can't search. */
export type PairableWatchEvent =
  | PairableEvent
  | { readonly kind: 'denied' }
  | { readonly kind: 'failed'; readonly code: string }

export type EngineQueries = {
  listDevices(): Promise<UsbmuxDevice[]>
  /** Lock state, Developer Mode and iOS version of a paired device. */
  deviceStatus(udid: string): Promise<DeviceCheck>
  /**
   * Pairs with the device when it doesn't trust this computer yet (the Trust prompt shows on the device and this
   * waits for the tap), then reads its status like `deviceStatus`.
   */
  pairDevice(udid: string): Promise<DeviceCheck>
  /** The Apple TVs and Vision Pros paired by code, whether or not they're on the network now. */
  codePairedDevices(): Promise<CodePairedDevice[]>
  /** Forgets an Apple TV or Vision Pro paired by code: its pairing goes, the apps on it stay. */
  forgetCodePaired(udid: string): Promise<void>
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
  /** App sources (the built-in ones and those added) with what was last read from each. */
  listSources(): Promise<readonly SourceInfo[]>
  /** The apps of every AltStore-format source that's on, read again when their copy is old. */
  sourceApps(): Promise<readonly SourceApps[]>
  /** Reads a link as an app source without saving it: what Add source shows before it's confirmed. */
  checkSource(url: string): Promise<SourcePreview>
  addSource(url: string): Promise<SourceInfo>
  /** Forgets a source the user added (a built-in one can only be turned off). */
  removeSource(id: string): Promise<void>
  setSourceEnabled(id: string, enabled: boolean): Promise<void>
  /** Reads one source again, or every source that's on; returns the list after. */
  refreshSources(id?: string): Promise<readonly SourceInfo[]>
  /**
   * The apps on the device signed with one of `teamIds`, soonest to expire first, each with the Engine's record
   * when it installed it (then it can be refreshed). Read from the device: its profiles say when each expires.
   */
  installedApps(query: InstalledAppsQuery): Promise<InstalledApp[]>
  /** Deletes the app from the device and forgets it, with its kept IPA. */
  removeApp(input: RemoveAppInput): Promise<void>
  /** For each app to refresh: a new profile only (its certificate is still valid), or signed and installed again. */
  refreshPlan(query: RefreshPlanQuery): Promise<RefreshDecision[]>
  /**
   * Repair SideStore's check: the device's state and SideStore's (version, expiry, the certificates that signed it
   * and that it holds, its pairing file). Asks Apple for the team's certificates.
   */
  checkSideStore(query: CheckSideStoreQuery): Promise<SideStoreCheck>
  /** A catalog app's latest release on each of its channels (its details): version, .ipa link, size and date. */
  catalogReleases(appId: string): Promise<CatalogRelease[]>
  /** What the on-device checklist needs about the device's apps (LocalDevVPN installed). */
  deviceApps(udid: string): Promise<DeviceApps>
  /** Makes the Developer Mode switch appear in the device's Settings. */
  revealDeveloperMode(udid: string): Promise<void>
  /** The setup guide's check of this computer: the device service, Apple, the clock and anisette. */
  systemCheck(): Promise<SystemCheck>
  /** Revokes one of the team's certificates: every app it signed stops opening until it's signed again. */
  revokeCertificate(query: TeamQuery, serialNumber: string): Promise<void>
  /** Deletes one of the team's App IDs (by Apple's id); on a free team it still counts until it expires. */
  deleteAppId(query: TeamQuery, appIdId: string): Promise<void>
  appGroups(query: TeamQuery): Promise<TeamAppGroups>
  registeredDevices(query: TeamQuery): Promise<TeamDevices>
  /** The provisioning profiles on the device, each with whether an installed app uses it. */
  deviceProfiles(udid: string): Promise<DeviceProfileInfo[]>
  removeDeviceProfiles(udid: string, uuids: readonly string[]): Promise<void>
  /** The device's pairing apps and other apps IPAForge installed, with whose pairing files each holds. */
  pairingFiles(query: PairingQuery): Promise<AppPairing[]>
  /** Writes this computer's pairing file into one app (an own app at the path given, remembered). */
  placeAppPairing(input: PlacePairingInput): Promise<void>
  removeAppPairing(query: PairingTargetQuery): Promise<void>
  /** A new remote pairing (may ask to Trust again), placed in every app that reads one; the old one stops working. */
  newRemotePairing(query: PairingQuery): Promise<void>
  /** This computer's certificate for the team, with its private key, as a .p12 under `password`. */
  exportCertificate(query: TeamQuery, password: string): Promise<Uint8Array>
  /**
   * Keeps a .p12's certificate and key as this computer's for the team (no new certificate, no slot used), once
   * Apple lists that certificate for the team and the key is its own.
   */
  importCertificate(
    query: TeamQuery,
    p12: Uint8Array,
    password: string
  ): Promise<{ readonly serialNumber: string }>
  /** This computer's pairing file for the device (an XML plist), for saving: another tool asks for it. */
  devicePairingFile(udid: string): Promise<string>
  /** The anisette servers in the order Automatic tries them, the choice, and SideStore's list's age. */
  anisetteServers(): Promise<AnisetteOverview>
  /** Automatic, or always one server of the list. Each change below returns the servers after it. */
  chooseAnisetteServer(choice: AnisetteChoice): Promise<AnisetteOverview>
  /** Adds a server, used first (and chosen when the user picks servers). */
  addAnisetteServer(input: AnisetteServerInput): Promise<AnisetteOverview>
  updateAnisetteServer(
    address: string,
    input: AnisetteServerInput
  ): Promise<AnisetteOverview>
  removeAnisetteServer(address: string): Promise<AnisetteOverview>
  /** Whether a server answers and how fast: one in the list, or an address being added. */
  testAnisetteServer(address: string): Promise<AnisetteServerTest>
  /** Fetches SideStore's list of servers now. */
  updateAnisetteServerList(): Promise<AnisetteOverview>
}

/** One app's pairing files, as the Pairing files dialog shows them. */
export type AppPairing = {
  readonly bundleId: string
  readonly name: string
  /** A pairing app IPAForge knows (its paths are known), or another app IPAForge installed (a path the user gives). */
  readonly kind: 'known' | 'own'
  readonly classic: ClassicPairingState
  /** When the classic file was written, when the device says. */
  readonly placedAt?: Date
  /** Known apps that read a remote pairing file, on iOS 17.4 and later. */
  readonly remote?: RemotePairingFileState
  /** Own apps: where its pairing file goes, once given. */
  readonly path?: string
}

export type PairingQuery = {
  readonly udid: string
  readonly teamIds: readonly string[]
}

export type PairingTargetQuery = PairingQuery & {
  readonly bundleId: string
}

export type PlacePairingInput = PairingTargetQuery & {
  /** Own apps only: where the file goes (`Documents/…` or `Library/…`, ending in .plist or .mobiledevicepairing). */
  readonly path?: string
}

export type InstalledAppsQuery = {
  readonly udid: string
  readonly teamIds: readonly string[]
}

export type RemoveAppInput = {
  readonly udid: string
  readonly bundleId: string
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

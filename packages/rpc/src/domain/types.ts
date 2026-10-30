import type {
  DeviceWatchEvent,
  Diagnosis,
  EngineQueries,
  InstallPlan,
  InstallState,
  PairableWatchEvent,
  PairByCodeState,
  PairingState,
  PromptRequest,
  RunEvent,
  SignInState
} from '@ipaforge/installer'
import type {
  IPAForgeError,
  LogEntry,
  LogLevel,
  LogPage,
  LogPageQuery,
  LogRecord
} from '@ipaforge/kernel'
import type {
  RemoteCheckpoint,
  RemoteInstallAppsInput,
  RemoteInstallSideStoreInput,
  RemotePairByCodeInput,
  RemotePlacePairingInput,
  RemotePlanInstallInput,
  RemoteRefreshAppsInput,
  RemoteRepairSideStoreInput,
  RemoteSignInInput
} from '@rpc/domain/protocol/types.ts'

// The Engine as the UI sees it across the channel: the same queries and run handles, with IPAs named instead of
// opened, run states without their file handles, and checkpoints held by the server and resumed by reference.

export type RemoteResult<S> =
  | { readonly status: 'completed'; readonly state: S }
  | {
      readonly status: 'failed'
      readonly error: IPAForgeError
      readonly failedStep: string
      readonly checkpoint: RemoteCheckpoint
    }
  | { readonly status: 'cancelled'; readonly checkpoint: RemoteCheckpoint }

export type RemoteCommandOptions = {
  /** Continue a failed or cancelled run of the same command from its checkpoint. */
  readonly resume?: RemoteCheckpoint
  /** Aborting cancels the run, like `cancel()`. */
  readonly signal?: AbortSignal
}

/** The Engine's `RunHandle`, over the channel. `result` rejects only when the run cannot start or the channel closes. */
export type RemoteRunHandle<S> = {
  subscribe(listener: (event: RunEvent) => void): () => void
  pending(): PromptRequest | undefined
  answer(answer: unknown): void
  decline(): void
  cancel(): void
  readonly result: Promise<RemoteResult<S>>
}

/** The Engine's log buffer, for the log viewer: paged and searched on the Engine's side, then live. */
export type EngineLogs = {
  /** The newest matching entries, oldest first; pass `before` (the oldest `seq` shown) for the next page up. */
  page(query?: LogPageQuery): Promise<LogPage>
  /** Every new entry, unfiltered; returns the function that stops listening. */
  watch(listener: (entry: LogEntry) => void): () => void
  level(): Promise<LogLevel>
  /** Until the app restarts; the host starts at its own level (`LOG_LEVEL`, else info). */
  setLevel(level: LogLevel): Promise<void>
  /** Keeps a record the UI logged with the Engine's. Fire and forget: a failure is dropped, never logged. */
  write(record: LogRecord): void
}

/** A folder the user picked for Save signed .ipa instead: an id the Engine knows it by, and its name to show. */
export type ChosenFolder = {
  readonly id: string
  readonly name: string
}

/** An IPA the user picked in the host's file dialog: where it is (to name it as a file source), its name and size. */
export type ChosenIpa = {
  readonly path: string
  readonly name: string
  readonly size: number
}

export type EngineClient = Omit<EngineQueries, 'planInstall'> & {
  planInstall(input: RemotePlanInstallInput): Promise<InstallPlan>
  installSideStore(
    input: RemoteInstallSideStoreInput,
    options?: RemoteCommandOptions
  ): RemoteRunHandle<Wire<InstallState>>
  installApps(
    input: RemoteInstallAppsInput,
    options?: RemoteCommandOptions
  ): RemoteRunHandle<Wire<InstallState>>
  refreshApps(
    input: RemoteRefreshAppsInput,
    options?: RemoteCommandOptions
  ): RemoteRunHandle<Wire<InstallState>>
  repairSideStore(
    input: RemoteRepairSideStoreInput,
    options?: RemoteCommandOptions
  ): RemoteRunHandle<Wire<InstallState>>
  placePairing(
    input: RemotePlacePairingInput,
    options?: RemoteCommandOptions
  ): RemoteRunHandle<Wire<PairingState>>
  /** Adds an Apple ID; answer its `apple.password` prompt (and any second factor) through the handle. */
  signIn(
    input: RemoteSignInInput,
    options?: RemoteCommandOptions
  ): RemoteRunHandle<Wire<SignInState>>
  /**
   * Connected devices as they come and go: the full list first, then each attach and detach with the list after
   * it. Returns the function that stops listening; the channel closing stops it too.
   */
  watchDevices(listener: (event: DeviceWatchEvent) => void): () => void
  /**
   * Apple TVs and Vision Pros showing their pairing screen, as they appear and go (`denied` when the OS refuses
   * local network access). Returns the function that stops the search; the channel closing stops it too.
   */
  watchPairableDevices(
    listener: (event: PairableWatchEvent) => void
  ): () => void
  /** Pairs an Apple TV or Vision Pro by the code it shows; answer its `device.pairing_code` prompt. */
  pairByCode(
    input: RemotePairByCodeInput,
    options?: RemoteCommandOptions
  ): RemoteRunHandle<Wire<PairByCodeState>>
  /** Forgets a saved Apple ID (account, session, saved password); its certificates stay for the next sign-in. */
  signOut(accountId: string): Promise<void>
  /** Runs locally: errors arrive as IPAForgeErrors with their code, data and cause chain intact. */
  classify(error: unknown): Diagnosis
  readonly logs: EngineLogs
  /** Opens the host's file dialog for IPAs (none when cancelled, or when the host has no dialog). */
  chooseIpas(): Promise<readonly ChosenIpa[]>
  /** Opens the host's folder dialog for Save signed .ipa instead (nothing when cancelled, or without a dialog). */
  chooseSaveFolder(): Promise<ChosenFolder | undefined>
}

// What a value looks like after crossing the channel. Structured clone keeps data (Maps, Dates, bytes) but refuses
// functions, so they are dropped first: a FileSource in a run's state arrives as `{ name, size }`.

export type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined

export type AnyFunction = (...args: never[]) => unknown

export type Wire<T> = T extends Primitive | Date | Uint8Array
  ? T
  : T extends AnyFunction
    ? never
    : T extends ReadonlyMap<infer K, infer V>
      ? ReadonlyMap<K, Wire<V>>
      : T extends readonly (infer U)[]
        ? readonly Wire<U>[]
        : {
            readonly [K in keyof T as T[K] extends AnyFunction
              ? never
              : K]: Wire<T[K]>
          }

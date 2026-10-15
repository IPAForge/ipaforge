// The Engine as the UI sees it across the channel: the same queries and run handles, with IPAs named instead of
// opened, run states without their file handles, and checkpoints held by the server and resumed by reference.
import type {
  Diagnosis,
  EngineQueries,
  InstallPlan,
  InstallState,
  PairingState,
  PromptRequest,
  RunEvent
} from '@loadstar/installer'
import type { LoadstarError } from '@loadstar/kernel'
import type {
  RemoteInstallAppsInput,
  RemoteInstallSideStoreInput,
  RemotePlacePairingInput,
  RemotePlanInstallInput
} from '@rpc/domain/protocol/inputs.ts'
import type { RemoteCheckpoint } from '@rpc/domain/protocol/messages.ts'
import type { Wire } from '@rpc/domain/wire.ts'

export type RemoteResult<S> =
  | { readonly status: 'completed'; readonly state: S }
  | {
      readonly status: 'failed'
      readonly error: LoadstarError
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
  placePairing(
    input: RemotePlacePairingInput,
    options?: RemoteCommandOptions
  ): RemoteRunHandle<Wire<PairingState>>
  /** Runs locally: errors arrive as LoadstarErrors with their code, data and cause chain intact. */
  classify(error: unknown): Diagnosis
}

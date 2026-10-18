import type { Checkpoint, CommandOptions, RunHandle } from '@ipaforge/installer'
import type {
  Command,
  CommandCall,
  MessageBody,
  QueryCall,
  RemoteCheckpoint,
  Request
} from '@rpc/domain/protocol/types.ts'

export type Kept = {
  readonly command: Command
  readonly checkpoint: Checkpoint<unknown>
}

export type CheckpointStore = {
  keep(command: Command, checkpoint: Checkpoint<unknown>): RemoteCheckpoint
  /** The checkpoint to resume `command` from. */
  get(id: string, command: Command): Checkpoint<unknown>
  /** Called once a resumed run has started: it makes its own checkpoint if it stops again. */
  forget(id: string): void
  clear(): void
}

export type Options = CommandOptions<unknown>

export type CommandStarters = {
  readonly [C in CommandCall as C['command']]: (
    input: C['input'],
    options: Options,
    signal: AbortSignal
  ) => Promise<RunHandle<unknown>>
}

export type StartCommand = (
  call: CommandCall,
  options: Options,
  signal: AbortSignal
) => Promise<RunHandle<unknown>>

export type PlanInstallCall = Extract<
  QueryCall,
  { method: 'planInstall' }
>['args'][0]

export type InstallAppsCall = Extract<
  CommandCall,
  { command: 'installApps' }
>['input']

export type QueryHandlers = {
  readonly [C in QueryCall as C['method']]: (
    args: C['args'],
    signal: AbortSignal
  ) => Promise<unknown>
}

export type RunQuery = (
  call: QueryCall,
  signal: AbortSignal
) => Promise<unknown>

export type StartRequest = Extract<Request, { type: 'start' }>

export type ActiveRun = {
  readonly controller: AbortController
  /** Set once the command has started (its inputs may take a while: an IPA download). */
  handle?: RunHandle<unknown>
}

export type RunRegistryDeps = {
  readonly startCommand: StartCommand
  readonly checkpoints: CheckpointStore
  readonly send: (message: MessageBody) => void
}

export type RunRegistry = {
  start(request: StartRequest): Promise<void>
  answer(runId: string, answer: unknown): void
  decline(runId: string): void
  cancel(runId: string): void
  /** Cancels every run (the channel closed). */
  cancelAll(): void
}

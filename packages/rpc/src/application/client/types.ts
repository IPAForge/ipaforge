import type { IPAForgeError, Logger } from '@ipaforge/kernel'
import type {
  RequestBody,
  WireRunEvent,
  WireRunResult
} from '@rpc/domain/protocol/types.ts'
import type { RemoteRunHandle } from '@rpc/domain/types.ts'

export type Waiting = {
  readonly resolve: (value: unknown) => void
  readonly reject: (error: IPAForgeError) => void
  readonly timer: ReturnType<typeof setTimeout>
}

export type RequestTable = {
  send(body: RequestBody): Promise<unknown>
  resolve(id: string, value: unknown): void
  reject(id: string, error: IPAForgeError): void
  /** Rejects everything waiting, and every later request, with `rpc.disconnected`. */
  close(): void
}

export type ClientRun<S> = {
  readonly handle: RemoteRunHandle<S>
  event(event: WireRunEvent): void
  finish(result: WireRunResult): void
  fail(error: IPAForgeError): void
}

export type ClientRunDeps = {
  readonly runId: string
  readonly request: (body: RequestBody) => Promise<unknown>
  readonly logger: Logger
}

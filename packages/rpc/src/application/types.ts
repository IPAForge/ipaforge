import type { Engine } from '@loadstar/installer'
import type { Logger } from '@loadstar/kernel'
import type { RpcConfig } from '@rpc/domain/config.ts'
import type { LogSource } from '@rpc/domain/ports/log-source.ts'
import type { ResolveIpa } from '@rpc/domain/ports/resolve-ipa.ts'
import type { Transport } from '@rpc/domain/ports/transport.ts'
import type { Message, Request } from '@rpc/domain/protocol/types.ts'

export type MessageHandlers = {
  readonly [M in Message as M['type']]: (message: M) => void
}

export type EngineClientOptions = {
  readonly config?: Partial<RpcConfig>
  readonly logger?: Logger
}

export type RpcServerOptions = {
  readonly engine: Engine
  readonly transport: Transport
  readonly resolveIpa: ResolveIpa
  /** The host's log buffer, for the log viewer; without it the viewer is empty. */
  readonly logs?: LogSource
  readonly logger?: Logger
}

export type RpcServer = {
  /** Cancels every run and closes the channel. */
  close(): void
}

export type RequestHandlers = {
  readonly [R in Request as R['type']]: (request: R) => unknown
}

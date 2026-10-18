import type { Engine } from '@ipaforge/installer'
import type { Logger } from '@ipaforge/kernel'
import type { RpcConfig } from '@rpc/domain/config.ts'
import type { ChooseIpas } from '@rpc/domain/ports/choose-ipas.ts'
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
  /** The host's file dialog for IPAs; without it, choosing files answers with none. */
  readonly chooseIpas?: ChooseIpas
  readonly logger?: Logger
}

export type RpcServer = {
  /** Cancels every run and closes the channel. */
  close(): void
}

export type RequestHandlers = {
  readonly [R in Request as R['type']]: (request: R) => unknown
}

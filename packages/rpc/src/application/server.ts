// The Engine's side of the channel: validates every request, answers queries, starts and tracks runs, and sends
// every failure back as a serialized LoadstarError. Nothing a peer sends can make it throw.

import type { z } from 'zod'

import type { Engine } from '@loadstar/installer'
import {
  ErrorCode,
  type LoadstarError,
  type Logger,
  silentLogger,
  toLoadstarError
} from '@loadstar/kernel'
import { createCheckpointStore } from '@rpc/application/server/checkpoints.ts'
import { createCommandStarter } from '@rpc/application/server/commands.ts'
import { createQueryRunner } from '@rpc/application/server/queries.ts'
import { createRunRegistry } from '@rpc/application/server/runs.ts'
import { createSubscriptionRegistry } from '@rpc/application/server/subscriptions.ts'
import { invalidMessage } from '@rpc/domain/errors.ts'
import type { ResolveIpa } from '@rpc/domain/ports/resolve-ipa.ts'
import type { Transport } from '@rpc/domain/ports/transport.ts'
import { PROTOCOL_VERSION, referencedId } from '@rpc/domain/protocol/common.ts'
import type { MessageBody } from '@rpc/domain/protocol/messages.ts'
import { type Request, requestSchema } from '@rpc/domain/protocol/requests.ts'
import { toWire } from '@rpc/domain/wire.ts'

export type RpcServerOptions = {
  readonly engine: Engine
  readonly transport: Transport
  readonly resolveIpa: ResolveIpa
  readonly logger?: Logger
}

export type RpcServer = {
  /** Cancels every run and closes the channel. */
  close(): void
}

type RequestHandlers = {
  readonly [R in Request as R['type']]: (request: R) => unknown
}

export const createRpcServer = ({
  engine,
  transport,
  resolveIpa,
  logger = silentLogger
}: RpcServerOptions): RpcServer => {
  const log = logger.child({ scope: 'rpc' })
  const lifetime = new AbortController()
  const checkpoints = createCheckpointStore()

  const send = (body: MessageBody): void => {
    if (lifetime.signal.aborted) return
    try {
      transport.send({ v: PROTOCOL_VERSION, ...body })
    } catch (error) {
      log.warn('RPC send failed', {
        type: body.type,
        code: toLoadstarError(error).code
      })
    }
  }

  const runQuery = createQueryRunner(engine, resolveIpa)
  const runs = createRunRegistry({
    startCommand: createCommandStarter(engine, resolveIpa),
    checkpoints,
    send
  })

  const subscriptions = createSubscriptionRegistry(engine, send)

  const handlers: RequestHandlers = {
    query: (request) => runQuery(request.call, lifetime.signal),
    start: (request) => runs.start(request),
    answer: (request) => runs.answer(request.runId, request.answer),
    decline: (request) => runs.decline(request.runId),
    cancel: (request) => runs.cancel(request.runId),
    subscribe: (request) =>
      subscriptions.subscribe(request.subscriptionId, request.topic),
    unsubscribe: (request) => subscriptions.unsubscribe(request.subscriptionId)
  }

  const sendError = (id: string, error: LoadstarError): void => {
    // A catalogued failure is an answer the UI shows; an unexpected one is a bug worth seeing in the log.
    if (error.code === ErrorCode.Unexpected)
      log.warn('RPC request failed unexpectedly', {
        id,
        message: error.message,
        cause: error.cause
      })
    else log.debug('RPC request failed', { id, code: error.code })
    send({ type: 'error', id, error: error.toJSON() })
  }

  const respond = async (request: Request): Promise<void> => {
    try {
      const value = await (
        handlers[request.type] as (request: Request) => unknown
      )(request)
      send({ type: 'response', id: request.id, value: toWire(value) })
    } catch (error) {
      sendError(request.id, toLoadstarError(error))
    }
  }

  const rejectInvalid = (message: unknown, issues: z.ZodError): void => {
    const error = invalidMessage(issues)
    log.warn('invalid RPC request', { issues: error.data?.issues })
    const id = referencedId(message)
    if (id !== undefined) sendError(id, error)
  }

  const onMessage = (message: unknown): void => {
    const parsed = requestSchema.safeParse(message)
    if (!parsed.success) {
      rejectInvalid(message, parsed.error)
      return
    }
    void respond(parsed.data)
  }

  const unsubscribe = transport.onMessage(onMessage)

  const shutdown = (): void => {
    if (lifetime.signal.aborted) return
    lifetime.abort()
    unsubscribe()
    stopWatchingClose()
    runs.cancelAll()
    subscriptions.closeAll()
    checkpoints.clear()
  }

  const stopWatchingClose = transport.onClose(shutdown)

  return {
    close: () => {
      shutdown()
      transport.close()
    }
  }
}

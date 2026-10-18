// The Engine's side of the channel: validates every request, answers queries, starts and tracks runs, and sends
// every failure back as a serialized IPAForgeError. Nothing a peer sends can make it throw.

import type { z } from 'zod'

import {
  ErrorCode,
  type IPAForgeError,
  type LogRecord,
  silentLogger,
  toIPAForgeError
} from '@ipaforge/kernel'
import { createCheckpointStore } from '@rpc/application/server/checkpoints.ts'
import { createCommandStarter } from '@rpc/application/server/commands.ts'
import { createLogRequests } from '@rpc/application/server/logs.ts'
import { createQueryRunner } from '@rpc/application/server/queries.ts'
import { createRunRegistry } from '@rpc/application/server/runs.ts'
import { createSubscriptionRegistry } from '@rpc/application/server/subscriptions.ts'
import type {
  RequestHandlers,
  RpcServer,
  RpcServerOptions
} from '@rpc/application/types.ts'
import { invalidMessage } from '@rpc/domain/errors.ts'
import { PROTOCOL_VERSION, referencedId } from '@rpc/domain/protocol/common.ts'
import { requestSchema } from '@rpc/domain/protocol/requests.ts'
import type { MessageBody, Request } from '@rpc/domain/protocol/types.ts'
import { toWire } from '@rpc/domain/wire.ts'

export const createRpcServer = ({
  engine,
  transport,
  resolveIpa,
  logs,
  logger = silentLogger
}: RpcServerOptions): RpcServer => {
  const log = logger.child({ scope: 'rpc' })
  const lifetime = new AbortController()
  const checkpoints = createCheckpointStore()

  /** `quiet` sends never log a failure: a log entry that fails to send must not log another entry to send. */
  const send = (body: MessageBody, { quiet = false } = {}): void => {
    if (lifetime.signal.aborted) return
    try {
      transport.send({ v: PROTOCOL_VERSION, ...body })
    } catch (error) {
      if (quiet) return
      log.warn('RPC send failed', {
        type: body.type,
        code: toIPAForgeError(error).code
      })
    }
  }

  const runQuery = createQueryRunner(engine, resolveIpa)
  const runs = createRunRegistry({
    startCommand: createCommandStarter(engine, resolveIpa),
    checkpoints,
    send
  })

  const subscriptions = createSubscriptionRegistry(
    engine,
    logs,
    (subscriptionId, event, options) =>
      send({ type: 'subscription-event', subscriptionId, event }, options)
  )
  const logRequests = createLogRequests(logs)

  const handlers: RequestHandlers = {
    query: (request) => runQuery(request.call, lifetime.signal),
    start: (request) => runs.start(request),
    answer: (request) => runs.answer(request.runId, request.answer),
    decline: (request) => runs.decline(request.runId),
    cancel: (request) => runs.cancel(request.runId),
    subscribe: (request) =>
      subscriptions.subscribe(request.subscriptionId, request.topic),
    unsubscribe: (request) => subscriptions.unsubscribe(request.subscriptionId),
    logs: (request) => logRequests.page(request.query),
    'log-level': (request) => logRequests.level(request.level),
    log: (request) => logRequests.write(request.record as LogRecord)
  }

  const sendError = (id: string, error: IPAForgeError): void => {
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
      sendError(request.id, toIPAForgeError(error))
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

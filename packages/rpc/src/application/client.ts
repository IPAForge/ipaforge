// The UI's side of the channel: an EngineClient that mirrors the Engine. Queries are requests; a command starts a
// run under an id the client picks, so the handle exists (and collects events) before the server acknowledges it.

import type { z } from 'zod'

import { classify, type DeviceWatchEvent } from '@loadstar/installer'
import {
  compact,
  LoadstarError,
  type Logger,
  silentLogger,
  toLoadstarError
} from '@loadstar/kernel'
import { createRequestTable } from '@rpc/application/client/requests.ts'
import { type ClientRun, createClientRun } from '@rpc/application/client/run.ts'
import { DEFAULT_RPC_CONFIG, type RpcConfig } from '@rpc/domain/config.ts'
import type {
  EngineClient,
  RemoteCommandOptions,
  RemoteRunHandle
} from '@rpc/domain/engine-client.ts'
import { disconnected, invalidMessage } from '@rpc/domain/errors.ts'
import type { Transport } from '@rpc/domain/ports/transport.ts'
import { referencedId } from '@rpc/domain/protocol/common.ts'
import { type Message, messageSchema } from '@rpc/domain/protocol/messages.ts'
import type {
  CommandCallInput,
  QueryCallInput
} from '@rpc/domain/protocol/requests.ts'

type MessageHandlers = {
  readonly [M in Message as M['type']]: (message: M) => void
}

export type EngineClientOptions = {
  readonly config?: Partial<RpcConfig>
  readonly logger?: Logger
}

/** Aborting the signal cancels the run, like the Engine's `CommandOptions.signal`. */
const cancelOnAbort = (
  signal: AbortSignal | undefined,
  cancel: () => void
): void => {
  if (signal?.aborted) {
    cancel()
    return
  }
  signal?.addEventListener('abort', cancel, { once: true })
}

export const createEngineClient = (
  transport: Transport,
  options: EngineClientOptions = {}
): EngineClient => {
  const config = { ...DEFAULT_RPC_CONFIG, ...options.config }
  const logger = (options.logger ?? silentLogger).child({ scope: 'rpc' })
  const requests = createRequestTable(transport, config.requestTimeoutMs)
  const runs = new Map<string, ClientRun<unknown>>()
  const subscriptions = new Map<string, (event: DeviceWatchEvent) => void>()

  /** Query results are trusted to have the Engine's types: the envelope is validated, the payload is the Engine's. */
  const query = <T>(call: QueryCallInput): Promise<T> =>
    requests.send({ type: 'query', call }) as Promise<T>

  const start = <S>(
    call: CommandCallInput,
    options: RemoteCommandOptions = {}
  ): RemoteRunHandle<S> => {
    const runId = crypto.randomUUID()
    const run = createClientRun<S>({ runId, request: requests.send, logger })
    runs.set(runId, run as ClientRun<unknown>)
    requests
      .send(
        compact({
          type: 'start' as const,
          runId,
          call,
          resume: options.resume?.id
        })
      )
      .catch((error) => {
        runs.delete(runId)
        run.fail(error)
      })
    cancelOnAbort(options.signal, run.handle.cancel)
    return run.handle
  }

  /** A live feed: events go to `listener` until the returned function is called or the channel closes. */
  const watchDevices = (
    listener: (event: DeviceWatchEvent) => void
  ): (() => void) => {
    const subscriptionId = crypto.randomUUID()
    const failed = (type: string) => (error: unknown) =>
      logger.debug('RPC subscription request failed', {
        subscriptionId,
        type,
        code: toLoadstarError(error).code
      })
    subscriptions.set(subscriptionId, listener)
    requests
      .send({ type: 'subscribe', subscriptionId, topic: 'devices' })
      .catch(failed('subscribe'))
    return () => {
      if (!subscriptions.delete(subscriptionId)) return
      requests
        .send({ type: 'unsubscribe', subscriptionId })
        .catch(failed('unsubscribe'))
    }
  }

  const endRun = (runId: string): ClientRun<unknown> | undefined => {
    const run = runs.get(runId)
    runs.delete(runId)
    return run
  }

  const handlers: MessageHandlers = {
    response: (message) => requests.resolve(message.id, message.value),
    error: (message) =>
      requests.reject(message.id, LoadstarError.fromJSON(message.error)),
    'run-event': (message) => runs.get(message.runId)?.event(message.event),
    'run-result': (message) => endRun(message.runId)?.finish(message.result),
    'run-error': (message) =>
      endRun(message.runId)?.fail(LoadstarError.fromJSON(message.error)),
    'subscription-event': (message) =>
      subscriptions.get(message.subscriptionId)?.(
        compact(message.event) as DeviceWatchEvent
      )
  }

  const rejectInvalid = (raw: unknown, issues: z.ZodError): void => {
    const error = invalidMessage(issues)
    logger.warn('invalid RPC message', { issues: error.data?.issues })
    const id = referencedId(raw)
    if (id !== undefined) requests.reject(id, error)
  }

  const onMessage = (raw: unknown): void => {
    const parsed = messageSchema.safeParse(raw)
    if (!parsed.success) {
      rejectInvalid(raw, parsed.error)
      return
    }
    ;(handlers[parsed.data.type] as (message: Message) => void)(parsed.data)
  }

  const onClose = (): void => {
    requests.close()
    subscriptions.clear()
    for (const runId of [...runs.keys()]) endRun(runId)?.fail(disconnected())
  }

  transport.onMessage(onMessage)
  transport.onClose(onClose)

  return {
    listDevices: () => query({ method: 'listDevices', args: [] }),
    deviceStatus: (udid) => query({ method: 'deviceStatus', args: [udid] }),
    listAccounts: () => query({ method: 'listAccounts', args: [] }),
    listTeams: (accountId) => query({ method: 'listTeams', args: [accountId] }),
    catalogApps: () => query({ method: 'catalogApps', args: [] }),
    recommendedChannel: (appId, iosVersion) =>
      query({ method: 'recommendedChannel', args: [appId, iosVersion] }),
    appIdQuota: (teamQuery) =>
      query({ method: 'appIdQuota', args: [teamQuery] }),
    listCertificates: (teamQuery) =>
      query({ method: 'listCertificates', args: [teamQuery] }),
    planInstall: (input) => query({ method: 'planInstall', args: [input] }),
    installSideStore: (input, options) =>
      start({ command: 'installSideStore', input }, options),
    installApps: (input, options) =>
      start({ command: 'installApps', input }, options),
    placePairing: (input, options) =>
      start({ command: 'placePairing', input }, options),
    signIn: (input, options) => start({ command: 'signIn', input }, options),
    watchDevices,
    classify
  }
}

// The UI's handle on a run in the Engine: events replayed to late subscribers, the waiting prompt, and the result.
// Answers, declines and cancels go to the server; the server's events and outcome come back through `deliver`.
import type { PromptRequest, RunEvent } from '@loadstar/installer'
import { compact, LoadstarError, toLoadstarError } from '@loadstar/kernel'
import type { ClientRun, ClientRunDeps } from '@rpc/application/client/types.ts'
import { createEventLog } from '@rpc/application/event-log.ts'
import { noPrompt } from '@rpc/domain/errors.ts'
import type {
  RequestBody,
  WireRunEvent,
  WireRunResult
} from '@rpc/domain/protocol/types.ts'
import type { RemoteResult } from '@rpc/domain/types.ts'

const toRunEvent = (event: WireRunEvent): RunEvent => {
  if (event.type === 'step-failed')
    return { ...event, error: LoadstarError.fromJSON(event.error) }
  if (event.type === 'prompt')
    return { type: event.type, request: compact(event.request) }
  return compact(event) as RunEvent
}

const toResult = <S>(result: WireRunResult): RemoteResult<S> => {
  // The state is the Engine's run state without its file handles: `S` is `Wire<…>` of that state.
  if (result.status === 'completed')
    return { status: result.status, state: result.state as S }
  if (result.status === 'cancelled') return result
  return { ...result, error: LoadstarError.fromJSON(result.error) }
}

export const createClientRun = <S>({
  runId,
  request,
  logger
}: ClientRunDeps): ClientRun<S> => {
  const events = createEventLog<RunEvent>()
  let pending: PromptRequest | undefined
  let ended = false
  let settle: {
    resolve: (result: RemoteResult<S>) => void
    reject: (error: LoadstarError) => void
  }
  const result = new Promise<RemoteResult<S>>((resolve, reject) => {
    settle = { resolve, reject }
  })
  // A UI that never looks at the result must not see an unhandled rejection when the channel closes.
  result.catch(() => {})

  /** The server is authoritative: if the run ended meanwhile, its outcome arrives anyway. */
  const tell = (body: RequestBody): void => {
    request(body).catch((error: unknown) =>
      logger.debug('RPC run request failed', {
        runId,
        type: body.type,
        code: toLoadstarError(error).code
      })
    )
  }

  const takePrompt = (): void => {
    if (!pending) throw noPrompt()
    pending = undefined
  }

  const end = (): void => {
    ended = true
    pending = undefined
  }

  return {
    handle: {
      subscribe: events.subscribe,
      pending: () => pending,
      answer: (answer) => {
        takePrompt()
        tell({ type: 'answer', runId, answer })
      },
      decline: () => {
        takePrompt()
        tell({ type: 'decline', runId })
      },
      cancel: () => {
        if (!ended) tell({ type: 'cancel', runId })
      },
      result
    },
    event: (wire) => {
      const event = toRunEvent(wire)
      if (event.type === 'prompt') pending = event.request
      events.emit(event)
    },
    finish: (wire) => {
      end()
      settle.resolve(toResult<S>(wire))
    },
    fail: (error) => {
      end()
      settle.reject(error)
    }
  }
}

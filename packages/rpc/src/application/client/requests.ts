// Requests waiting for their response: each settles once, on its response, its timeout, or the channel closing.
import { type IPAForgeError, toIPAForgeError } from '@ipaforge/kernel'
import type { RequestTable, Waiting } from '@rpc/application/client/types.ts'
import { disconnected, timedOut } from '@rpc/domain/errors.ts'
import type { Transport } from '@rpc/domain/ports/transport.ts'
import { PROTOCOL_VERSION } from '@rpc/domain/protocol/common.ts'
import type { RequestBody } from '@rpc/domain/protocol/types.ts'

export const createRequestTable = (
  transport: Transport,
  timeoutMs: number
): RequestTable => {
  const waiting = new Map<string, Waiting>()
  let closed = false

  const settle = (id: string): Waiting | undefined => {
    const entry = waiting.get(id)
    if (!entry) return undefined
    waiting.delete(id)
    clearTimeout(entry.timer)
    return entry
  }

  const reject = (id: string, error: IPAForgeError): void =>
    settle(id)?.reject(error)

  const post = (id: string, body: RequestBody): void => {
    try {
      transport.send({ v: PROTOCOL_VERSION, id, ...body })
    } catch (error) {
      reject(id, toIPAForgeError(error, disconnected().code))
    }
  }

  return {
    send: (body) => {
      if (closed) return Promise.reject(disconnected())
      const id = crypto.randomUUID()
      const response = new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(
          () => settle(id)?.reject(timedOut(timeoutMs)),
          timeoutMs
        )
        waiting.set(id, { resolve, reject, timer })
      })
      post(id, body)
      return response
    },
    resolve: (id, value) => settle(id)?.resolve(value),
    reject,
    close: () => {
      closed = true
      for (const id of [...waiting.keys()]) reject(id, disconnected())
    }
  }
}

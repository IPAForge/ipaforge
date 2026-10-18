// Prompts answered through the run handle: a question waits until `answer` or `decline`, or the run is cancelled.

import type { Pending, PromptQueue } from '@installer/engine/types.ts'
import type { PromptRequest } from '@installer/pipeline/types.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const noPrompt = (): IPAForgeError =>
  new IPAForgeError(ErrorCode.Unexpected, { message: 'no prompt is waiting' })

export const createPromptQueue = (
  onAsked: (request: PromptRequest) => void
): PromptQueue => {
  let current: Pending | undefined

  const settle = (): Pending => {
    const pending = current
    if (!pending) throw noPrompt()
    current = undefined
    return pending
  }

  const ask = (request: PromptRequest, signal: AbortSignal): Promise<unknown> =>
    new Promise((resolve, reject) => {
      signal.throwIfAborted()
      current = { request, resolve, reject }
      signal.addEventListener('abort', () => current?.reject(signal.reason), {
        once: true
      })
      onAsked(request)
    })

  return {
    ask,
    pending: () => current?.request,
    answer: (answer) => settle().resolve(answer),
    decline: () => settle().reject(new IPAForgeError(ErrorCode.PromptCancelled))
  }
}

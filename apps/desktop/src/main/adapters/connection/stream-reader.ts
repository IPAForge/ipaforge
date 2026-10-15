import type { Buffer } from 'node:buffer'
import type { Socket } from 'node:net'
import type { TLSSocket } from 'node:tls'

import { ErrorCode, LoadstarError } from '@loadstar/kernel'

export type Stream = Socket | TLSSocket

export type StreamReader = {
  readonly read: () => Promise<Uint8Array | null>
  /** Stops listening (and pauses the stream) so another reader can take over, e.g. after a TLS upgrade. */
  readonly detach: () => void
}

type Waiter = {
  readonly resolve: (chunk: Uint8Array | null) => void
  readonly reject: (error: unknown) => void
}

/** Turns 'data'/'end'/'error' events into pull-based reads, with backpressure via pause/resume. */
export const attachReader = (stream: Stream): StreamReader => {
  const chunks: Uint8Array[] = []
  const waiters: Waiter[] = []
  let ended = false
  let failure: unknown

  const onData = (data: Buffer) => {
    const chunk = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    const waiter = waiters.shift()
    if (waiter) {
      waiter.resolve(chunk)
      return
    }
    chunks.push(chunk)
    stream.pause()
  }
  const onEnd = () => {
    ended = true
    for (const waiter of waiters.splice(0)) waiter.resolve(null)
  }
  const onError = (error: Error) => {
    failure = new LoadstarError(ErrorCode.DeviceDisconnected, { cause: error })
    for (const waiter of waiters.splice(0)) waiter.reject(failure)
  }
  stream.on('data', onData)
  stream.on('end', onEnd)
  stream.on('close', onEnd)
  stream.on('error', onError)

  return {
    read: () => {
      const chunk = chunks.shift()
      if (chunk) {
        if (chunks.length === 0) stream.resume()
        return Promise.resolve(chunk)
      }
      if (failure) return Promise.reject(failure)
      if (ended) return Promise.resolve(null)
      stream.resume()
      return new Promise((resolve, reject) => waiters.push({ resolve, reject }))
    },
    detach: () => {
      stream.off('data', onData)
      stream.off('end', onEnd)
      stream.off('close', onEnd)
      stream.off('error', onError)
      stream.pause()
    }
  }
}

export const writeTo = (stream: Stream, bytes: Uint8Array): Promise<void> =>
  new Promise((resolve, reject) => {
    stream.write(bytes, (error) =>
      error
        ? reject(
            new LoadstarError(ErrorCode.DeviceDisconnected, { cause: error })
          )
        : resolve()
    )
  })

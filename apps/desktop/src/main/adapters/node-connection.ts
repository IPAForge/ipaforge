// Node implementation of the device `Connection` port: a net.Socket that can be upgraded to TLS in place.
import type { Socket } from 'node:net'

import { upgradeToDeviceTls } from '@desktop/main/adapters/connection/device-tls.ts'
import {
  attachReader,
  type Stream,
  writeTo
} from '@desktop/main/adapters/connection/stream-reader.ts'
import type { Connection } from '@loadstar/device'
import { ErrorCode, LoadstarError } from '@loadstar/kernel'

const CLOSE_TIMEOUT_MS = 1000

/** Half-closes politely; forces the stream shut if the peer never answers. */
const closeStream = (stream: Stream): Promise<void> =>
  new Promise((resolve) => {
    if (stream.destroyed) {
      resolve()
      return
    }
    const timer = setTimeout(() => stream.destroy(), CLOSE_TIMEOUT_MS)
    timer.unref()
    stream.once('close', () => {
      clearTimeout(timer)
      resolve()
    })
    stream.end()
  })

export const createNodeConnection = (socket: Socket): Connection => {
  let stream: Stream = socket
  let reader = attachReader(socket)

  return {
    read: () => reader.read(),
    write: (bytes) => writeTo(stream, bytes),
    startTls: async (credentials) => {
      if (stream !== socket)
        throw new LoadstarError(ErrorCode.DeviceProtocolError, {
          message: 'TLS already active'
        })
      reader.detach()
      const secure = await upgradeToDeviceTls(socket, credentials)
      stream = secure
      reader = attachReader(secure)
    },
    close: () => closeStream(stream)
  }
}

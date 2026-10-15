// Node DeviceTransport: connects to the system usbmuxd (Unix socket on macOS/Linux, TCP 27015 on Windows).
import { connect, type Socket } from 'node:net'

import { createNodeConnection } from '@desktop/main/adapters/node-connection.ts'
import {
  describeEndpoint,
  resolveUsbmuxdEndpoint,
  type UsbmuxdEndpoint,
  usbmuxdHint
} from '@desktop/main/adapters/usbmux/usbmuxd-endpoint.ts'
import type { DeviceTransport } from '@loadstar/device'
import { ErrorCode, LoadstarError } from '@loadstar/kernel'

const CONNECT_TIMEOUT_MS = 5000

const connectTo = (endpoint: UsbmuxdEndpoint): Socket =>
  endpoint.kind === 'unix'
    ? connect({ path: endpoint.path })
    : connect({ host: endpoint.host, port: endpoint.port })

const unavailable = (endpoint: UsbmuxdEndpoint, cause: Error) =>
  new LoadstarError(ErrorCode.UsbmuxdUnavailable, {
    cause,
    data: { endpoint: describeEndpoint(endpoint), hint: usbmuxdHint() }
  })

const open = (endpoint: UsbmuxdEndpoint): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket = connectTo(endpoint)
    const timer = setTimeout(
      () => socket.destroy(new Error('timed out connecting to usbmuxd')),
      CONNECT_TIMEOUT_MS
    )
    const onError = (error: Error) => {
      clearTimeout(timer)
      reject(unavailable(endpoint, error))
    }
    socket.once('connect', () => {
      clearTimeout(timer)
      socket.off('error', onError)
      resolve(socket)
    })
    socket.once('error', onError)
  })

export const createNodeUsbmuxTransport = (
  endpoint: UsbmuxdEndpoint = resolveUsbmuxdEndpoint()
): DeviceTransport => ({
  connectUsbmux: async () => createNodeConnection(await open(endpoint))
})

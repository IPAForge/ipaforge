// Node `connectTcp`: a TCP connection straight to a device's Wi-Fi address (lockdown on 62078, then each service's
// port), as the device `Connection` port, so lockdown's TLS and every service run on it unchanged.
import { connect, type Socket } from 'node:net'

import { localNetworkError } from '@desktop/main/adapters/network/local-network-error.ts'
import { createNodeConnection } from '@desktop/main/adapters/node-connection.ts'
import type { Connection } from '@ipaforge/device'

const CONNECT_TIMEOUT_MS = 5000
const KEEP_ALIVE_MS = 10_000

const open = (host: string, port: number): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket = connect({ host, port, noDelay: true })
    const timer = setTimeout(
      () =>
        socket.destroy(new Error(`timed out connecting to ${host}:${port}`)),
      CONNECT_TIMEOUT_MS
    )
    const onError = (error: Error) => {
      clearTimeout(timer)
      reject(localNetworkError(error))
    }
    socket.once('connect', () => {
      clearTimeout(timer)
      socket.off('error', onError)
      socket.setKeepAlive(true, KEEP_ALIVE_MS)
      resolve(socket)
    })
    socket.once('error', onError)
  })

export const connectTcp = async (
  host: string,
  port: number
): Promise<Connection> => createNodeConnection(await open(host, port))

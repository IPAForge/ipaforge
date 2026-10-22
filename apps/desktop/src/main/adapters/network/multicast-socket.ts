// Node `openMulticast`: a UDP socket on a port of its own (never 5353, so it never competes with Bonjour or
// avahi), sending each mDNS query out of every IPv4 interface, and hearing the answers sent straight back to it.
import { createSocket, type Socket } from 'node:dgram'
import { networkInterfaces } from 'node:os'

import { localNetworkError } from '@desktop/main/adapters/network/local-network-error.ts'
import {
  type Datagram,
  MDNS_GROUP,
  MDNS_PORT,
  type MulticastSocket
} from '@ipaforge/device'

const MULTICAST_TTL = 255

/** The computer's IPv4 addresses on real networks (not loopback). */
const lanAddresses = (): string[] =>
  Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => address.address)

const bind = (socket: Socket): Promise<void> =>
  new Promise((resolve, reject) => {
    socket.once('error', reject)
    socket.bind(0, () => {
      socket.off('error', reject)
      resolve()
    })
  })

const sendOn = (
  socket: Socket,
  bytes: Uint8Array,
  from: string
): Promise<void> =>
  new Promise((resolve, reject) => {
    try {
      socket.setMulticastInterface(from)
    } catch (error) {
      reject(error)
      return
    }
    socket.send(bytes, MDNS_PORT, MDNS_GROUP, (error) =>
      error ? reject(error) : resolve()
    )
  })

export const openMulticast = async (): Promise<MulticastSocket> => {
  const socket = createSocket({ type: 'udp4' })
  await bind(socket)
  socket.setMulticastTTL(MULTICAST_TTL)
  const listeners = new Set<(datagram: Datagram) => void>()
  socket.on('message', (bytes, from) => {
    const datagram = { bytes: new Uint8Array(bytes), from: from.address }
    for (const listener of [...listeners]) listener(datagram)
  })
  socket.on('error', () => undefined)

  return {
    send: async (bytes) => {
      const addresses = lanAddresses()
      const results = await Promise.allSettled(
        addresses.map((address) => sendOn(socket, bytes, address))
      )
      const failure = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected'
      )
      // Sent on at least one network: fine. On none (or no network at all): say why.
      if (results.some((result) => result.status === 'fulfilled')) return
      throw localNetworkError(failure?.reason)
    },
    onMessage: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close: () =>
      new Promise((resolve) => {
        listeners.clear()
        socket.close(() => resolve())
      })
  }
}

import { createServer, type Server } from 'node:net'

import { afterEach, describe, expect, it } from 'vitest'

import { localNetworkError } from '@desktop/main/adapters/network/local-network-error.ts'
import { connectTcp } from '@desktop/main/adapters/network/tcp-connection.ts'
import { ErrorCode } from '@ipaforge/kernel'

const errno = (code: string) => Object.assign(new Error(code), { code })

describe('localNetworkError', () => {
  it('reads a refused send on macOS as local network access denied', () => {
    expect(localNetworkError(errno('EHOSTUNREACH'), 'darwin').code).toBe(
      ErrorCode.LocalNetworkDenied
    )
  })

  it('reads anything else, or elsewhere, as a lost connection', () => {
    expect(localNetworkError(errno('ENETUNREACH'), 'darwin').code).toBe(
      ErrorCode.DeviceDisconnected
    )
    expect(localNetworkError(errno('EHOSTUNREACH'), 'win32').code).toBe(
      ErrorCode.DeviceDisconnected
    )
  })
})

describe('connectTcp', () => {
  let server: Server | undefined
  afterEach(() => server?.close())

  it('connects straight to an address and port, as a device Connection', async () => {
    server = createServer((socket) =>
      socket.on('data', (bytes) => socket.write(bytes))
    )
    await new Promise<void>((resolve) =>
      server?.listen(0, '127.0.0.1', resolve)
    )
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0

    const connection = await connectTcp('127.0.0.1', port)
    await connection.write(new TextEncoder().encode('lockdown'))
    expect(
      new TextDecoder().decode((await connection.read()) ?? new Uint8Array())
    ).toBe('lockdown')
    await connection.close()
  })

  it('fails with a device error when nothing listens there', async () => {
    server = createServer()
    await new Promise<void>((resolve) =>
      server?.listen(0, '127.0.0.1', resolve)
    )
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    await new Promise<void>((resolve) => server?.close(() => resolve()))
    server = undefined

    await expect(connectTcp('127.0.0.1', port)).rejects.toMatchObject({
      code: ErrorCode.DeviceDisconnected
    })
  })
})

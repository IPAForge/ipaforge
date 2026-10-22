// IPAForge's own TLS 1.2 PSK client (packages/device) against OpenSSL's server, with the cipher suite iOS's remote
// pairing tunnel takes. It lives here because packages can't use node:tls.
import { randomBytes } from 'node:crypto'
import { createServer, type Server, type TLSSocket } from 'node:tls'

import { afterEach, describe, expect, it } from 'vitest'

import { connectTcp } from '@desktop/main/adapters/network/tcp-connection.ts'
import { connectTlsPsk } from '@ipaforge/device'

const PSK = new Uint8Array(32).fill(7)

const listen = (psk: Uint8Array): Promise<{ server: Server; port: number }> =>
  new Promise((resolve) => {
    const server = createServer(
      {
        ciphers: 'PSK-AES128-GCM-SHA256',
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.2',
        pskCallback: () => Buffer.from(psk)
      },
      (socket: TLSSocket) =>
        socket.on('data', (bytes) =>
          socket.write(Buffer.concat([Buffer.from('echo:'), bytes]))
        )
    )
    server.on('tlsClientError', () => undefined)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({
        server,
        port: typeof address === 'object' && address ? address.port : 0
      })
    })
  })

const random = (length: number) => new Uint8Array(randomBytes(length))

describe('TLS 1.2 PSK client', () => {
  let server: Server | undefined
  afterEach(() => server?.close())

  it('completes the handshake with OpenSSL and carries data both ways', async () => {
    const started = await listen(PSK)
    server = started.server
    const tls = await connectTlsPsk(
      await connectTcp('127.0.0.1', started.port),
      {
        psk: PSK,
        randomBytes: random
      }
    )

    await tls.write(new TextEncoder().encode('CDTunnel'))
    expect(
      new TextDecoder().decode((await tls.read()) ?? new Uint8Array())
    ).toBe('echo:CDTunnel')

    // More than one record's worth, split by the client and reassembled by the server.
    const big = new Uint8Array(40_000).fill(65)
    await tls.write(big)
    let received = 0
    while (received < big.length + 5)
      received += (await tls.read())?.length ?? big.length
    expect(received).toBeGreaterThanOrEqual(big.length)
    await tls.close()
  })

  it('fails when the server holds another key', async () => {
    const started = await listen(new Uint8Array(32).fill(9))
    server = started.server
    await expect(
      connectTlsPsk(await connectTcp('127.0.0.1', started.port), {
        psk: PSK,
        randomBytes: random
      })
    ).rejects.toMatchObject({ code: 'device.protocol_error' })
  })
})

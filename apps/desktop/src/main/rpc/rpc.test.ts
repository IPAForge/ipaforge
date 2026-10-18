import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createFileDownloadStore } from '@desktop/main/adapters/file-download-store.ts'
import { portPair } from '@desktop/main/rpc/__tests__/port-pair.ts'
import { messagePortTransport } from '@desktop/main/rpc/message-port-transport.ts'
import { createIpaResolver } from '@desktop/main/rpc/resolve-ipa.ts'
import type { Engine } from '@ipaforge/installer'
import { ErrorCode, type HttpClient } from '@ipaforge/kernel'
import { createEngineClient, createRpcServer } from '@ipaforge/rpc'

const dirs: string[] = []
const tempDir = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ipaforge-rpc-'))
  dirs.push(dir)
  return dir
}
afterEach(async () => {
  for (const dir of dirs.splice(0))
    await rm(dir, { recursive: true, force: true })
})

const bodyOf = (text: string) =>
  new Blob([text]).stream() as ReadableStream<Uint8Array>

describe('messagePortTransport', () => {
  it('carries the protocol between main and renderer ports, and reports the close', async () => {
    const [mainPort, rendererPort] = portPair()
    const engine = {
      listDevices: async () => [{ udid: 'UDID1' }]
    } as unknown as Engine
    createRpcServer({
      engine,
      transport: messagePortTransport(mainPort),
      resolveIpa: vi.fn()
    })
    const client = createEngineClient(messagePortTransport(rendererPort))

    expect(await client.listDevices()).toEqual([{ udid: 'UDID1' }])

    const pending = client.listAccounts()
    mainPort.close()
    await expect(pending).rejects.toMatchObject({
      code: ErrorCode.RpcDisconnected
    })
  })
})

describe('createIpaResolver', () => {
  it('opens a picked file, and refuses one that cannot be read', async () => {
    const dir = await tempDir()
    const path = join(dir, 'My App.ipa')
    await writeFile(path, 'ipa bytes')
    const resolve = createIpaResolver({
      http: { request: vi.fn() },
      store: createFileDownloadStore(dir)
    })
    const signal = new AbortController().signal

    const file = await resolve({ kind: 'file', path }, signal)
    expect({ name: file.name, size: file.size }).toEqual({
      name: 'My App.ipa',
      size: 9
    })
    await expect(
      resolve({ kind: 'file', path: join(dir, 'missing.ipa') }, signal)
    ).rejects.toMatchObject({
      code: ErrorCode.InvalidBundle
    })
  })

  it('downloads a URL into the download store', async () => {
    const http: HttpClient = {
      request: async ({ url }) =>
        url.endsWith('gone.ipa')
          ? { status: 404, headers: {}, body: bodyOf('') }
          : { status: 200, headers: {}, body: bodyOf('downloaded') }
    }
    const resolve = createIpaResolver({
      http,
      store: createFileDownloadStore(await tempDir())
    })
    const signal = new AbortController().signal

    const file = await resolve(
      { kind: 'url', url: 'https://example.com/apps/Thing.ipa' },
      signal
    )
    expect(file.name).toBe('Thing.ipa')
    expect(new TextDecoder().decode(await file.slice(0, file.size))).toBe(
      'downloaded'
    )
    await expect(
      resolve({ kind: 'url', url: 'https://example.com/gone.ipa' }, signal)
    ).rejects.toMatchObject({
      code: ErrorCode.DownloadFailed,
      data: { status: 404 }
    })
  })
})

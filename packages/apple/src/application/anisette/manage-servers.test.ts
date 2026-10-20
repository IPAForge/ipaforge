import { describe, expect, it, vi } from 'vitest'

import { createAnisetteService } from '@apple/application/anisette.ts'
import { resolveAppleDeps } from '@apple/deps.ts'
import type { AnisetteServer } from '@apple/domain/types.ts'
import { ErrorCode, type HttpClient, type SecretStore } from '@ipaforge/kernel'

const LIST_URL = 'https://servers.sidestore.io/servers.json'

/** SideStore's list as the test serves it: one shared with the backup, one plain HTTP. */
const LIST: AnisetteServer[] = [
  { name: 'SideStore', address: 'https://ani.sidestore.io' },
  { name: 'jkcoxson', address: 'https://mac-ani.jkcoxson.com' },
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- plain HTTP from the list must be left out
  { name: 'Plain', address: 'http://192.0.2.1:6969' }
]

const BACKUP: AnisetteServer[] = [
  { name: 'StikStore', address: 'https://ani3.stikstore.app' },
  { name: 'jkcoxson (built in)', address: 'https://mac-ani.jkcoxson.com' }
]

const memorySecrets = (): SecretStore => {
  const values = new Map<string, Uint8Array>()

  return {
    get: async (key) => values.get(key),
    set: async (key, value) => {
      values.set(key, value)
    },
    delete: async (key) => {
      values.delete(key)
    }
  }
}

/** Only the list answers; every anisette server is down. */
const setup = () => {
  const asked: string[] = []
  const request = vi.fn(async (req: { url: string }) => {
    asked.push(req.url)
    if (req.url !== LIST_URL) throw new Error('down')
    return {
      status: 200,
      headers: {},
      body: new Response(JSON.stringify({ servers: LIST }))
        .body as ReadableStream<Uint8Array<ArrayBuffer>>
    }
  })
  const deps = resolveAppleDeps({
    http: { request } as unknown as HttpClient,
    webSocket: undefined as never,
    secrets: memorySecrets(),
    clock: { now: () => new Date(1000) },
    sleep: async () => {},
    config: { retryAttempts: 1, fallbackAnisetteServers: BACKUP }
  })

  return { anisette: createAnisetteService(deps), asked }
}

// eslint-disable-next-line sonarjs/no-clear-text-protocols -- a server the user runs at home may be plain HTTP
const MINE = { name: 'Mine', address: 'http://192.168.1.20:6969' }

describe('anisette servers in Settings', () => {
  it("lists SideStore's HTTPS servers in order, then the backup it lacks, and says what it left out", async () => {
    const { anisette } = setup()
    const overview = await anisette.overview()

    expect(
      overview.servers.map((server) => [server.source, server.name])
    ).toEqual([
      ['list', 'SideStore'],
      ['list', 'jkcoxson'],
      ['backup', 'StikStore']
    ])
    expect(overview.choice).toEqual({ mode: 'automatic' })
    expect(overview.listUpdatedAt).toBe(1000)
    expect(overview.skipped).toEqual(['Plain'])
  })

  it('puts a server the user adds first, plain HTTP allowed, and chooses it when picking servers', async () => {
    const { anisette } = setup()
    await anisette.choose({ mode: 'chosen' })
    const overview = await anisette.addServer(MINE)

    expect(overview.servers[0]).toEqual({ ...MINE, source: 'custom' })
    expect(overview.choice).toEqual({ mode: 'chosen', server: MINE })
  })

  it('refuses a server already in the list, a placeholder or a nameless one', async () => {
    const { anisette } = setup()

    await expect(
      anisette.addServer({
        name: 'Again',
        address: 'https://ani.sidestore.io/'
      })
    ).rejects.toMatchObject({ code: ErrorCode.AnisetteServerExists })
    await expect(
      anisette.addServer({ name: 'X', address: 'https://yourserver.com' })
    ).rejects.toMatchObject({ code: ErrorCode.AnisetteServerInvalid })
    await expect(
      anisette.addServer({ name: ' ', address: 'https://own.example.net.io' })
    ).rejects.toMatchObject({ code: ErrorCode.AnisetteServerInvalid })
  })

  it('edits and removes only servers the user added; removing the chosen one leaves none chosen', async () => {
    const { anisette } = setup()
    await anisette.addServer(MINE)
    await anisette.choose({ mode: 'chosen', server: MINE })
    const edited = await anisette.updateServer(MINE.address, {
      name: 'Home',
      address: MINE.address
    })
    expect(edited.choice).toEqual({
      mode: 'chosen',
      server: { name: 'Home', address: MINE.address }
    })

    await expect(
      anisette.removeServer('https://ani.sidestore.io')
    ).rejects.toMatchObject({ code: ErrorCode.AnisetteServerInvalid })
    const removed = await anisette.removeServer(MINE.address)
    expect(removed.servers.some((server) => server.source === 'custom')).toBe(
      false
    )
    expect(removed.choice).toEqual({ mode: 'chosen' })
  })

  it('uses only the chosen server, and says which one failed', async () => {
    const { anisette, asked } = setup()
    await anisette.overview()
    await anisette.choose({
      mode: 'chosen',
      server: { name: 'StikStore', address: 'https://ani3.stikstore.app' }
    })
    asked.length = 0

    await expect(anisette.get()).rejects.toMatchObject({
      code: ErrorCode.AnisetteUnavailable,
      data: { chosen: 'StikStore', tried: [{ server: 'StikStore' }] }
    })
    const others = [...LIST, ...BACKUP].filter(
      (server) => server.name !== 'StikStore'
    )
    expect(
      asked.filter((url) =>
        others.some((server) => url.startsWith(server.address))
      )
    ).toEqual([])
  })

  it('cannot choose a server that is not in the list', async () => {
    const { anisette } = setup()

    await expect(
      anisette.choose({ mode: 'chosen', server: MINE })
    ).rejects.toMatchObject({ code: ErrorCode.AnisetteServerInvalid })
  })

  it('tests a server, saying it does not answer', async () => {
    const { anisette } = setup()

    expect(await anisette.test('https://ani.sidestore.io')).toEqual({
      address: 'https://ani.sidestore.io',
      ok: false
    })
  })

  it("fetches SideStore's list again when asked, whatever its age", async () => {
    const { anisette, asked } = setup()
    await anisette.overview()
    const before = asked.filter((url) => url === LIST_URL).length
    await anisette.updateList()

    expect(asked.filter((url) => url === LIST_URL)).toHaveLength(before + 1)
  })
})

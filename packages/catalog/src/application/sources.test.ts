import { describe, expect, it } from 'vitest'

import { createCatalog } from '@catalog/application/catalog.ts'
import type { DownloadStore } from '@catalog/domain/ports/download-store.ts'
import type { SourceStore } from '@catalog/domain/ports/source-store.ts'
import { createMemorySourceStore } from '@catalog/infrastructure/memory-source-store.ts'
import {
  type Clock,
  ErrorCode,
  type HttpRequest,
  type HttpResponse,
  IPAForgeError,
  utf8Encode
} from '@ipaforge/kernel'

const respond = (status: number, body: string): HttpResponse => ({
  status,
  headers: {},
  body: new ReadableStream({
    start: (controller) => {
      controller.enqueue(utf8Encode(body))
      controller.close()
    }
  })
})

const source = (name: string, ...apps: string[]) =>
  JSON.stringify({
    name,
    apps: apps.map((app) => ({
      name: app,
      bundleIdentifier: `com.example.${app}`,
      version: '1.0',
      downloadURL: `https://example.com/${app}.ipa`
    }))
  })

const SIDESTORE = source('SideStore Official', 'SideStore')
const COMMUNITY_URL = 'https://example.com/apps.json'

type Routes = Record<string, () => HttpResponse>

const setup = (
  routes: Routes,
  store: SourceStore = createMemorySourceStore()
) => {
  const requested: string[] = []
  let now = new Date('2026-10-19T10:00:00Z')
  const clock: Clock = { now: () => new Date(now) }
  const http = {
    request: async (request: HttpRequest) => {
      requested.push(request.url)

      const route = routes[request.url]

      if (route) return route()
      if (request.url.includes('catalog/sources.json')) return respond(404, '')
      throw new IPAForgeError(ErrorCode.Offline, { message: 'offline' })
    }
  }
  const catalog = createCatalog({
    http,
    store: {} as DownloadStore,
    sourceStore: store,
    clock
  })

  return {
    sources: catalog.sources,
    requested,
    store,
    later: (ms: number) => {
      now = new Date(now.getTime() + ms)
    }
  }
}

const sidestoreRoute = {
  'https://apps.sidestore.io': () => respond(200, SIDESTORE)
}

describe('app sources', () => {
  it('lists the IPAForge catalog and SideStore, built in and on', async () => {
    const { sources } = setup(sidestoreRoute)
    const list = await sources.list()

    expect(
      list.map(({ id, kind, builtin, enabled }) => ({
        id,
        kind,
        builtin,
        enabled
      }))
    ).toEqual([
      { id: 'ipaforge', kind: 'catalog', builtin: true, enabled: true },
      { id: 'sidestore', kind: 'altstore', builtin: true, enabled: true }
    ])
    expect(list[0]?.name).toBe('IPAForge catalog')
    expect(list[0]?.appCount).toBeGreaterThan(0)
  })

  it("gives each AltStore source's apps, reading it once and reusing the copy until it's old", async () => {
    const { sources, requested, later } = setup(sidestoreRoute)

    const first = await sources.apps()

    expect(first).toEqual([
      expect.objectContaining({
        sourceId: 'sidestore',
        sourceName: 'SideStore Official',
        builtin: true
      })
    ])
    await sources.apps()
    expect(requested.filter((url) => url.includes('sidestore'))).toHaveLength(1)

    later(2 * 60 * 60 * 1000)
    await sources.apps()
    expect(requested.filter((url) => url.includes('sidestore'))).toHaveLength(2)
  })

  it('previews a source without saving it, then adds it on, first in the list after the built-in ones', async () => {
    const { sources } = setup({
      ...sidestoreRoute,
      [COMMUNITY_URL]: () =>
        respond(200, source('Community', 'Feather', 'Clips'))
    })

    const preview = await sources.check(`  ${COMMUNITY_URL}#top `)

    expect(preview.url).toBe(COMMUNITY_URL)
    expect(preview.content.apps.map((app) => app.name)).toEqual([
      'Feather',
      'Clips'
    ])
    expect(await sources.list()).toHaveLength(2)

    const added = await sources.add(COMMUNITY_URL)

    expect(added).toMatchObject({
      id: COMMUNITY_URL,
      builtin: false,
      enabled: true,
      name: 'Community',
      appCount: 2
    })
    expect((await sources.list()).map((entry) => entry.id)).toEqual([
      'ipaforge',
      'sidestore',
      COMMUNITY_URL
    ])
    expect((await sources.apps()).map((entry) => entry.sourceName)).toEqual([
      'SideStore Official',
      'Community'
    ])
  })

  it('keeps the list and each copy across restarts', async () => {
    const store = createMemorySourceStore()
    const routes = {
      ...sidestoreRoute,
      [COMMUNITY_URL]: () => respond(200, source('Community', 'Feather'))
    }

    await setup(routes, store).sources.add(COMMUNITY_URL)

    const restarted = setup({}, store)

    expect((await restarted.sources.list()).at(-1)).toMatchObject({
      name: 'Community',
      appCount: 1
    })
    expect(
      restarted.requested.filter((url) => url === COMMUNITY_URL)
    ).toHaveLength(0)
  })

  it('refuses a link that is not https, one already added, and one that is not a source', async () => {
    const { sources } = setup({
      ...sidestoreRoute,
      'https://example.com/page': () => respond(200, '<html></html>'),
      'https://example.com/list.json': () => respond(200, '{"name":"x"}')
    })

    await expect(
      sources.check('http://example.com/apps.json')
    ).rejects.toMatchObject({ code: ErrorCode.AppSourceInvalid })
    await expect(
      sources.check('https://apps.sidestore.io')
    ).rejects.toMatchObject({ code: ErrorCode.AppSourceExists })
    await expect(
      sources.check('https://example.com/page')
    ).rejects.toMatchObject({ code: ErrorCode.AppSourceInvalid })
    await expect(
      sources.check('https://example.com/list.json')
    ).rejects.toMatchObject({ code: ErrorCode.AppSourceInvalid })
    await expect(
      sources.check('https://example.com/missing.json')
    ).rejects.toMatchObject({ code: ErrorCode.AppSourceUnreachable })
  })

  it("keeps a source's last copy when a refresh fails, and says why", async () => {
    let up = true
    const { sources } = setup({
      'https://apps.sidestore.io': () =>
        up ? respond(200, SIDESTORE) : respond(503, '')
    })

    await sources.apps()
    up = false

    const list = await sources.refresh('sidestore')

    expect(list[1]).toMatchObject({
      appCount: 1,
      error: ErrorCode.AppSourceUnreachable
    })
    expect(await sources.apps()).toHaveLength(1)

    up = true
    expect((await sources.refresh())[1]?.error).toBeUndefined()
  })

  it('turns sources off and on, and removes only the ones the user added', async () => {
    const { sources } = setup({
      ...sidestoreRoute,
      [COMMUNITY_URL]: () => respond(200, source('Community', 'Feather'))
    })

    await sources.add(COMMUNITY_URL)

    await sources.setEnabled('sidestore', false)
    expect((await sources.list())[1]?.enabled).toBe(false)
    expect((await sources.apps()).map((entry) => entry.sourceId)).toEqual([
      COMMUNITY_URL
    ])

    await sources.setEnabled('sidestore', true)
    await sources.remove(COMMUNITY_URL)
    await sources.remove('sidestore')
    expect((await sources.list()).map((entry) => entry.id)).toEqual([
      'ipaforge',
      'sidestore'
    ])
  })
})

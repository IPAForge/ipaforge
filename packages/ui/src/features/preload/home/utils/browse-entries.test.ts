import { describe, expect, it } from 'vitest'

import type { BrowseInput } from '@ui/features/preload/home/types.ts'
import { browseEntries } from '@ui/features/preload/home/utils/browse-entries.ts'
import type { CatalogApp, SourceApp } from '@ui/services/engine/types.ts'

const catalogApp = (id: string, name: string, bundleId: string) =>
  ({ id, name, bundleId, kind: 'app', channels: {} }) as unknown as CatalogApp

const sourceApp = (
  name: string,
  bundleId: string,
  developer?: string
): SourceApp => ({
  bundleId,
  name,
  ...(developer ? { developer } : {}),
  versions: [{ version: '1.0', downloadUrl: `https://x.com/${name}.ipa` }]
})

const input = (overrides: Partial<BrowseInput> = {}): BrowseInput => ({
  catalogApps: [
    catalogApp('sidestore', 'SideStore', 'com.SideStore.SideStore'),
    catalogApp('livecontainer', 'LiveContainer', 'com.kdt.livecontainer'),
    catalogApp(
      'livecontainer-sidestore',
      'LiveContainer + SideStore',
      'com.kdt.livecontainer'
    )
  ],
  catalogName: 'IPAForge catalog',
  sources: [
    {
      sourceId: 'sidestore',
      sourceName: 'SideStore Official',
      builtin: true,
      apps: [sourceApp('SideStore', 'com.SideStore.SideStore')]
    },
    {
      sourceId: 'https://x.com/apps.json',
      sourceName: 'Community',
      builtin: false,
      apps: [
        sourceApp('Feather', 'kh.feather', 'khcrysalis'),
        sourceApp('SideStore', 'com.SideStore.SideStore')
      ]
    }
  ],
  filter: undefined,
  query: '',
  ...overrides
})

describe('browseEntries', () => {
  it('lists the catalog first and each app once, naming the other sources that have it', () => {
    const entries = browseEntries(input())

    expect(entries.map((entry) => `${entry.sourceId}:${entry.name}`)).toEqual([
      'ipaforge:SideStore',
      'ipaforge:LiveContainer',
      'ipaforge:LiveContainer + SideStore',
      'https://x.com/apps.json:Feather'
    ])
    expect(entries[0]?.also).toEqual(['SideStore Official', 'Community'])
  })

  it('shows only one source when filtered, with all of its apps', () => {
    const entries = browseEntries(input({ filter: 'https://x.com/apps.json' }))

    expect(entries.map((entry) => entry.name)).toEqual(['Feather', 'SideStore'])
  })

  it('leaves the catalog out when it is off', () => {
    const entries = browseEntries(input({ catalogName: undefined }))

    expect(entries[0]).toMatchObject({
      sourceId: 'sidestore',
      name: 'SideStore',
      also: ['Community']
    })
  })

  it('searches names and developers, ignoring case and spaces around', () => {
    expect(
      browseEntries(input({ query: ' KHCRY ' })).map((entry) => entry.name)
    ).toEqual(['Feather'])
    expect(browseEntries(input({ query: 'livecontainer' }))).toHaveLength(2)
    expect(browseEntries(input({ query: 'nothing' }))).toEqual([])
  })
})

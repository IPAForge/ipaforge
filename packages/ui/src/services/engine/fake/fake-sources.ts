// App sources for the fake Engine: the IPAForge catalog and SideStore built in, and links added by hand. A link with
// "unreachable" or "notsource" in it fails that way, and "skipped" leaves two apps out, so every case can be tried.
// Scenario `source-offline` makes SideStore's source fail to refresh (its last copy is still shown); `sources-added`
// starts with a source added by hand.
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import type { Engine } from '@ipaforge/rpc'
import { fakeCatalogApps } from '@ui/services/engine/fake/fake-data.ts'
import type {
  FakeSource as Entry,
  FakeSourceApp as SourceApp,
  FakeSourceInfo as SourceInfo
} from '@ui/services/engine/fake/types.ts'

const app = (
  name: string,
  bundleId: string,
  developer: string,
  subtitle: string,
  versions: readonly [string, number][],
  /** The app's colour, as real sources give it. */
  tint: string
): SourceApp => ({
  bundleId,
  name,
  developer,
  subtitle,
  description: `${name}: ${subtitle}`,
  tint,
  versions: versions.map(([version, size]) => ({
    version,
    date: '2026-10-01',
    downloadUrl: `https://example.com/${bundleId}/${version}/${name.replaceAll(' ', '')}.ipa`,
    size,
    minOsVersion: '15.0'
  }))
})

const SIDESTORE_APPS = [
  app(
    'SideStore',
    'com.SideStore.SideStore',
    'SideStore Team',
    'Refreshes and installs apps on the device by itself.',
    [
      ['0.6.2', 28_873_303],
      ['0.5.10', 9_300_000]
    ],
    '#7a3cf0'
  ),
  // Real sources have long names, and descriptions with links in them: they must wrap, never run out of the card.
  app(
    'LiveContainer - BETA NOT MEANT FOR USE YET',
    'com.kdt.livecontainer.beta',
    'khanhduytran0',
    'Run iOS apps without actually installing them! More info: https://github.com/khanhduytran0/LiveContainer/releases/latest',
    [['2.1.2', 91_750_400]],
    '#0b6e8a'
  )
]

const ADDED_APPS = [
  app(
    'PixelPlay',
    'dev.example.pixelplay',
    'Example Studio',
    'A retro game emulator.',
    [
      ['2.1.0', 33_000_000],
      ['2.0.4', 32_000_000]
    ],
    '#e65100'
  ),
  app(
    'Terminal X',
    'dev.example.terminal',
    'Example Studio',
    'A shell and SSH client.',
    [['1.8.2', 21_000_000]],
    '#37474f'
  ),
  app(
    'Clips Pro',
    'dev.example.clips',
    'Clipboard Labs',
    'Keeps everything you copy.',
    [['4.0.1', 6_000_000]],
    '#1d9bf0'
  ),
  app(
    'Feather',
    'kh.crysalis.feather',
    'khcrysalis',
    'Signs and installs apps on the device.',
    [['2.4.0', 14_000_000]],
    '#c2185b'
  )
]

const SIDESTORE_URL = 'https://apps.sidestore.io'

/** The source scenario `sources-added` starts with, as if added by hand. */
const ADDED_URL = 'https://example.com/apps.json'

export const createFakeSources = (
  scenario: string,
  wait: () => Promise<void>
): Pick<
  Engine,
  | 'listSources'
  | 'sourceApps'
  | 'checkSource'
  | 'addSource'
  | 'removeSource'
  | 'setSourceEnabled'
  | 'refreshSources'
> => {
  const fetchedAt = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const sidestoreDown = scenario === 'source-offline'
  let entries: Entry[] = [
    {
      id: 'ipaforge',
      url: 'https://raw.githubusercontent.com/IPAForge/ipaforge/main/catalog/sources.json',
      builtin: true,
      enabled: true,
      name: 'IPAForge catalog',
      apps: [],
      skipped: 0
    },
    {
      id: 'sidestore',
      url: SIDESTORE_URL,
      builtin: true,
      enabled: true,
      name: 'SideStore Official',
      apps: SIDESTORE_APPS,
      skipped: 0
    },
    ...(scenario === 'sources-added'
      ? [
          {
            id: ADDED_URL,
            url: ADDED_URL,
            builtin: false,
            enabled: true,
            name: 'Example Community Repo',
            apps: ADDED_APPS,
            skipped: 0
          }
        ]
      : [])
  ]

  const info = (entry: Entry): SourceInfo => ({
    id: entry.id,
    kind: entry.id === 'ipaforge' ? 'catalog' : 'altstore',
    url: entry.url,
    builtin: entry.builtin,
    enabled: entry.enabled,
    name: entry.name,
    appCount:
      entry.id === 'ipaforge' ? fakeCatalogApps.length : entry.apps.length,
    skipped: entry.skipped,
    ...(entry.id === 'ipaforge' ? {} : { fetchedAt }),
    ...(entry.id === 'sidestore' && sidestoreDown
      ? { error: ErrorCode.AppSourceUnreachable }
      : {})
  })

  const fail = (code: ErrorCode, url: string) => {
    throw new IPAForgeError(code, { message: code, data: { url } })
  }

  const check = async (url: string) => {
    await wait()

    const normalised = new URL(url.trim()).href

    if (entries.some((entry) => new URL(entry.url).href === normalised))
      fail(ErrorCode.AppSourceExists, normalised)
    if (normalised.includes('unreachable'))
      fail(ErrorCode.AppSourceUnreachable, normalised)
    if (normalised.includes('notsource'))
      fail(ErrorCode.AppSourceInvalid, normalised)

    const skipped = normalised.includes('skipped') ? 2 : 0

    return {
      url: normalised,
      content: {
        name: 'Example Community Repo',
        subtitle: 'Emulators, tools and utilities, kept by volunteers.',
        apps: skipped ? ADDED_APPS.slice(0, 2) : ADDED_APPS,
        skipped
      }
    }
  }

  return {
    listSources: async () => entries.map(info),
    sourceApps: async () =>
      entries
        .filter((entry) => entry.enabled && entry.id !== 'ipaforge')
        .map((entry) => ({
          sourceId: entry.id,
          sourceName: entry.name,
          builtin: entry.builtin,
          apps: entry.apps
        })),
    checkSource: check,
    addSource: async (url) => {
      const preview = await check(url)
      const entry = {
        id: preview.url,
        url: preview.url,
        builtin: false,
        enabled: true,
        name: preview.content.name,
        apps: preview.content.apps,
        skipped: preview.content.skipped
      }

      entries = [...entries, entry]

      return info(entry)
    },
    removeSource: async (id) => {
      entries = entries.filter((entry) => entry.builtin || entry.id !== id)
    },
    setSourceEnabled: async (id, enabled) => {
      entries = entries.map((entry) =>
        entry.id === id ? { ...entry, enabled } : entry
      )
    },
    refreshSources: async () => {
      await wait()

      return entries.map(info)
    }
  }
}

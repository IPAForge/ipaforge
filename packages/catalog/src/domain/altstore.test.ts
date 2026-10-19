import { describe, expect, it } from 'vitest'

import { isIpaDownload, readAltStoreSource } from '@catalog/domain/altstore.ts'

// Shapes taken from real sources: SideStore's (versions[] plus the latest on the app) and a community one (only the
// app-level fields, the older format).
const sidestoreLike = {
  name: 'SideStore Official',
  identifier: 'com.SideStore.SideStore',
  apps: [
    {
      name: 'SideStore',
      bundleIdentifier: 'com.SideStore.SideStore',
      developerName: 'SideStore Team',
      version: '0.6.2',
      versionDate: '2025-07-01T01:20:17Z',
      downloadURL:
        'https://github.com/SideStore/SideStore/releases/download/0.6.2/SideStore.ipa',
      size: 28_873_303,
      versions: [
        {
          version: '0.6.2',
          date: '2025-07-01T01:20:17Z',
          downloadURL:
            'https://github.com/SideStore/SideStore/releases/download/0.6.2/SideStore.ipa',
          size: 28_873_303
        },
        {
          version: '0.5.10',
          date: '2024-12-27T01:01:50Z',
          downloadURL:
            'https://github.com/SideStore/SideStore/releases/download/0.5.10/SideStore.ipa',
          size: 9_300_000,
          minOSVersion: '14.0'
        }
      ]
    }
  ]
}

const legacy = {
  name: 'Community',
  subtitle: 'Apps by volunteers',
  website: 'https://example.com',
  apps: [
    {
      name: 'Feather',
      bundleIdentifier: 'kh.crysalis.feather',
      version: '2.4.0',
      versionDate: '2024-9-07T18:30:00Z',
      downloadURL:
        'https://github.com/khcrysalis/Feather/releases/download/v2.4.0/Feather.ipa',
      size: 91_750_400
    }
  ]
}

describe('readAltStoreSource', () => {
  it('reads every version of an app, newest first, without repeating the app-level one', () => {
    const source = readAltStoreSource(sidestoreLike)

    expect(source?.name).toBe('SideStore Official')
    expect(source?.skipped).toBe(0)
    expect(source?.apps[0]?.versions.map((v) => v.version)).toEqual([
      '0.6.2',
      '0.5.10'
    ])
    expect(source?.apps[0]?.versions[1]).toEqual({
      version: '0.5.10',
      date: '2024-12-27T01:01:50Z',
      downloadUrl:
        'https://github.com/SideStore/SideStore/releases/download/0.5.10/SideStore.ipa',
      size: 9_300_000,
      minOsVersion: '14.0'
    })
  })

  it('reads the older format, where the app itself holds its only version, keeping loose dates as written', () => {
    const source = readAltStoreSource(legacy)

    expect(source?.subtitle).toBe('Apps by volunteers')
    expect(source?.apps[0]).toMatchObject({
      bundleId: 'kh.crysalis.feather',
      versions: [{ version: '2.4.0', date: '2024-9-07T18:30:00Z' }]
    })
  })

  it('leaves out, and counts, apps without an https .ipa download, broken entries and repeated bundle ids', () => {
    const source = readAltStoreSource({
      name: 'Mixed',
      apps: [
        ...legacy.apps,
        { ...legacy.apps[0], name: 'Again' },
        {
          name: 'Zip',
          bundleIdentifier: 'a.zip',
          version: '1',
          downloadURL: 'https://example.com/app.zip'
        },
        {
          name: 'Plain',
          bundleIdentifier: 'a.http',
          version: '1',

          downloadURL: 'http://example.com/app.ipa'
        },
        { name: 'No id' },
        'not an app'
      ]
    })

    expect(source?.apps.map((app) => app.name)).toEqual(['Feather'])
    expect(source?.skipped).toBe(5)
  })

  it("keeps an app's tint as #rrggbb, with or without the #, and drops anything else", () => {
    const tintOf = (tintColor: unknown) =>
      readAltStoreSource({
        name: 'Tints',
        apps: [
          {
            name: 'App',
            bundleIdentifier: 'com.example.app',
            tintColor,
            version: '1.0',
            downloadURL: 'https://example.com/App.ipa'
          }
        ]
      })?.apps[0]?.tint

    expect(tintOf('8A28F7')).toBe('#8a28f7')
    expect(tintOf('#1d9bf0')).toBe('#1d9bf0')
    expect(tintOf('blue')).toBeUndefined()
    expect(tintOf(0x1d9bf0)).toBeUndefined()
    expect(tintOf(undefined)).toBeUndefined()
  })

  it('is undefined for something that is not a source', () => {
    expect(readAltStoreSource({ apps: [] })).toBeUndefined()
    expect(readAltStoreSource({ name: 'x' })).toBeUndefined()
    expect(readAltStoreSource('<html>')).toBeUndefined()
  })
})

describe('isIpaDownload', () => {
  it('accepts only https links whose path ends in .ipa', () => {
    expect(isIpaDownload('https://x.com/a/App.ipa?token=1')).toBe(true)
    expect(isIpaDownload('https://x.com/a/App.IPA')).toBe(true)
    expect(isIpaDownload('https://x.com/download?file=App.ipa')).toBe(false)
    // eslint-disable-next-line sonarjs/no-clear-text-protocols -- an insecure link must be refused
    expect(isIpaDownload('http://x.com/App.ipa')).toBe(false)
    expect(isIpaDownload('not a url')).toBe(false)
  })
})

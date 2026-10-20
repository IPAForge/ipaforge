import { describe, expect, it } from 'vitest'

import { adoptSource } from '@ui/features/apps/utils/adopt-source.ts'
import type {
  CatalogApp,
  InstalledApp,
  SourceApps
} from '@ui/services/engine/types.ts'

const app: InstalledApp = {
  bundleId: 'com.spotify.client.TEAM',
  name: 'Spotify',
  version: '9.0.1',
  teamId: 'TEAM'
}

const source = (
  sourceName: string,
  versions: readonly string[],
  builtin = false
): SourceApps => ({
  sourceId: sourceName,
  sourceName,
  builtin,
  apps: [
    {
      bundleId: 'com.spotify.client',
      name: 'Spotify',
      versions: versions.map((version) => ({
        version,
        downloadUrl: `https://${sourceName}.example.com/${version}/Spotify.ipa`
      }))
    }
  ]
})

describe('adoptSource', () => {
  it('installs the version on the device from a source that lists it, and offers the others that do', () => {
    const plan = adoptSource(
      app,
      [],
      [
        source('foxster', ['9.2.0', '9.0.1']),
        source('driftywinds', ['9.1.0', '9.0.1'])
      ],
      'IPAForge catalog'
    )

    expect(plan).toMatchObject({
      kind: 'source',
      source: {
        kind: 'url',
        url: 'https://foxster.example.com/9.0.1/Spotify.ipa',
        version: '9.0.1'
      }
    })
    expect(
      plan?.kind === 'source'
        ? plan.choices?.map((choice) => [choice.from, choice.version])
        : []
    ).toEqual([
      ['foxster', '9.0.1'],
      ['driftywinds', '9.0.1']
    ])
  })

  it('never takes a newer or older version: a source without the one on the device is left out', () => {
    expect(
      adoptSource(
        app,
        [],
        [source('foxster', ['9.2.0']), source('driftywinds', ['9.0.0'])],
        'IPAForge catalog'
      )
    ).toBeUndefined()
  })

  it("prefers IPAForge's own sources among those that list the version", () => {
    const plan = adoptSource(
      app,
      [],
      [source('foxster', ['9.0.1']), source('SideStore', ['9.0.1'], true)],
      'IPAForge catalog'
    )

    expect(plan).toMatchObject({ from: 'SideStore' })
  })

  it('asks the catalog for the version on the device', () => {
    expect(
      adoptSource(
        app,
        [
          {
            id: 'spotify',
            bundleId: 'com.spotify.client'
          } as unknown as CatalogApp
        ],
        [],
        'IPAForge catalog'
      )
    ).toEqual({
      kind: 'source',
      source: { kind: 'catalog', appId: 'spotify', version: '9.0.1' },
      from: 'IPAForge catalog'
    })
  })
})

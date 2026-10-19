import { describe, expect, it } from 'vitest'

import { adoptSource } from '@ui/features/apps/utils/adopt-source.ts'
import type { InstalledApp, SourceApps } from '@ui/services/engine/types.ts'

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
  it('picks the source that lists the version on the device, and offers the others', () => {
    const plan = adoptSource(
      app,
      [],
      [source('foxster', ['9.2.0']), source('driftywinds', ['9.1.0', '9.0.1'])],
      'IPAForge catalog'
    )

    expect(plan).toMatchObject({ kind: 'source', from: 'driftywinds' })
    expect(
      plan?.kind === 'source' ? plan.choices?.map((choice) => choice.from) : []
    ).toEqual(['driftywinds', 'foxster'])
  })

  it("offers no choice when only one source lists it, and keeps a source's newest version", () => {
    const plan = adoptSource(
      app,
      [],
      [source('foxster', ['9.2.0', '9.0.1'])],
      'IPAForge catalog'
    )

    expect(plan).toEqual({
      kind: 'source',
      source: {
        kind: 'url',
        url: 'https://foxster.example.com/9.2.0/Spotify.ipa',
        replaces: 'com.spotify.client'
      },
      from: 'foxster'
    })
  })

  it("prefers IPAForge's own sources when none lists the version on the device", () => {
    const plan = adoptSource(
      app,
      [],
      [source('foxster', ['9.2.0']), source('SideStore', ['9.3.0'], true)],
      'IPAForge catalog'
    )

    expect(plan).toMatchObject({ from: 'SideStore' })
  })

  it('never picks a source older than the version on the device first, and labels it', () => {
    const plan = adoptSource(
      { ...app, version: '21.41.5' },
      [],
      [source('foxster', ['21.09.2']), source('driftywinds', ['21.41.5'])],
      'IPAForge catalog'
    )

    expect(plan).toMatchObject({ from: 'driftywinds' })
    expect(
      plan?.kind === 'source'
        ? plan.choices?.map((choice) => [choice.from, choice.isOlder ?? false])
        : []
    ).toEqual([
      ['driftywinds', false],
      ['foxster', true]
    ])
  })

  it('shows a single older source as a choice, so its label is seen', () => {
    const plan = adoptSource(
      { ...app, version: '21.41.5' },
      [],
      [source('foxster', ['21.09.2'])],
      'IPAForge catalog'
    )

    expect(plan?.kind === 'source' ? plan.choices : undefined).toHaveLength(1)
  })
})

import { describe, expect, it } from 'vitest'

import { appUpdate } from '@ui/features/apps/utils/app-update.ts'
import type { InstalledApp, SourceApps } from '@ui/services/engine/types.ts'

const ORIGIN_URL = 'https://repo.example.com/feather/2.4.0/Feather.ipa'

const installed = (origin: 'catalog' | 'url'): InstalledApp => ({
  bundleId: 'kh.crysalis.feather.TEAM',
  name: 'Feather',
  version: '2.4.0',
  teamId: 'TEAM',
  marker: {
    originalBundleId: 'kh.crysalis.feather',
    origin:
      origin === 'url'
        ? { kind: 'url', url: ORIGIN_URL }
        : { kind: 'catalog', appId: 'feather' }
  }
})

const source = (
  sourceId: string,
  builtin: boolean,
  versions: readonly string[]
): SourceApps => ({
  sourceId,
  sourceName: sourceId,
  builtin,
  apps: [
    {
      bundleId: 'kh.crysalis.feather',
      name: 'Feather',
      versions: versions.map((version) => ({
        version,
        downloadUrl: `https://${sourceId}.example.com/feather/${version}/Feather.ipa`
      }))
    }
  ]
})

describe('appUpdate', () => {
  it("doesn't take an update from a source you added for other apps", () => {
    expect(
      appUpdate(installed('catalog'), [source('stranger', false, ['9.9.9'])])
    ).toBeUndefined()
  })

  it("takes it from IPAForge's own sources, for the same app only", () => {
    expect(
      appUpdate(installed('catalog'), [source('sidestore', true, ['2.5.0'])])
    ).toEqual({
      version: '2.5.0',
      downloadUrl: 'https://sidestore.example.com/feather/2.5.0/Feather.ipa',
      replaces: 'kh.crysalis.feather'
    })
  })

  it('takes it from the source the app came from', () => {
    const repo: SourceApps = {
      ...source('repo', false, ['2.5.0']),
      apps: [
        {
          bundleId: 'kh.crysalis.feather',
          name: 'Feather',
          versions: [
            {
              version: '2.5.0',
              downloadUrl: 'https://repo.example.com/feather/2.5.0/Feather.ipa'
            },
            { version: '2.4.0', downloadUrl: ORIGIN_URL }
          ]
        }
      ]
    }

    expect(appUpdate(installed('url'), [repo])?.version).toBe('2.5.0')
  })
})

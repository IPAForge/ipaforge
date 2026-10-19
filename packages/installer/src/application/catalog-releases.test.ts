import { describe, expect, it } from 'vitest'

import { createHarness } from '@installer/__tests__/harness.ts'

const release = { github: { owner: 'example', repo: 'app' }, asset: 'App.ipa' }

describe('catalogReleases', () => {
  it('gives the latest release of each channel the app has, with its .ipa link', async () => {
    const harness = createHarness()

    Object.assign(harness.catalog.catalog, {
      manifest: async () => ({
        version: 1,
        apps: [
          {
            id: 'stikdebug',
            name: 'StikDebug',
            bundleId: 'com.stik.stikdebug',
            kind: 'app',
            channels: { stable: release }
          }
        ]
      })
    })

    expect(await harness.engine.catalogReleases('stikdebug')).toEqual([
      expect.objectContaining({
        channel: 'stable',
        version: '1.0',
        downloadUrl: 'https://example.com/a.ipa'
      })
    ])
    expect(harness.catalog.calls.resolved).toEqual(['stikdebug:stable'])
  })
})

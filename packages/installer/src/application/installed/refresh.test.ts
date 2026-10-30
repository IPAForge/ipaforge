// Refresh the way SideStore does it: an app whose certificate is still valid gets new profiles only (nothing is
// reinstalled); one whose certificate was revoked or replaced, or that carries no IPAForge mark, is installed again,
// and so is SideStore, which shows the expiry of the profile inside its own files.
import { describe, expect, it, vi } from 'vitest'

import {
  ACCOUNT,
  FREE_TEAM,
  installedApp,
  profile,
  UDID
} from '@installer/__tests__/fakes.ts'
import { createHarness, scripted } from '@installer/__tests__/harness.ts'
import {
  MARKER_KEY,
  markerFor
} from '@installer/application/installed/marker.ts'
import { createDict, ErrorCode, type PlistDict } from '@ipaforge/kernel'

vi.mock('@ipaforge/signer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ipaforge/signer')>()),
  exportPkcs12: vi.fn(() => new Uint8Array([0x30]))
}))

const APP = `com.example.app.${FREE_TEAM.id}`
const WIDGET = `${APP}.widget`
const VALID = 'AAAA01'
const REVOKED = 'BBBB02'

const marked = (
  serial?: string,
  origin: Parameters<typeof markerFor>[1] = {
    kind: 'url',
    url: 'https://x.com/a.ipa'
  }
): PlistDict =>
  createDict([[MARKER_KEY, markerFor('com.example.app', origin, serial)]])

/** A device with the app (and its widget's profile, unless iOS removed them), marked as signed with `serial`. */
const harnessWith = (
  raw: PlistDict,
  shortVersion?: string,
  profiles = [
    profile('old-app', FREE_TEAM.id, APP),
    profile('old-widget', FREE_TEAM.id, WIDGET)
  ],
  appIds = [APP, WIDGET, 'com.other.app']
) =>
  createHarness({
    device: {
      installed: new Map([
        [
          APP,
          {
            ...installedApp(APP, 'App'),
            raw,
            ...(shortVersion ? { shortVersion } : {})
          }
        ]
      ]),
      profiles
    },
    apple: {
      existingCertificates: [{ serialNumber: VALID, machineName: 'IPAForge' }],
      appIds
    }
  })

describe('refresh plan', () => {
  it('needs only new profiles while the certificate that signed the app is valid', async () => {
    const harness = harnessWith(marked(VALID))

    expect(
      await harness.engine.refreshPlan({
        udid: UDID,
        accountId: ACCOUNT,
        bundleIds: [APP]
      })
    ).toEqual([{ bundleId: APP, kind: 'profile' }])
  })

  it('installs again when the certificate is gone, or when the app carries no mark', async () => {
    expect(
      await harnessWith(marked(REVOKED)).engine.refreshPlan({
        udid: UDID,
        accountId: ACCOUNT,
        bundleIds: [APP]
      })
    ).toEqual([{ bundleId: APP, kind: 'reinstall', reason: 'certificate' }])
    expect(
      await harnessWith(createDict()).engine.refreshPlan({
        udid: UDID,
        accountId: ACCOUNT,
        bundleIds: [APP]
      })
    ).toEqual([{ bundleId: APP, kind: 'reinstall', reason: 'unmarked' }])
  })

  it('installs again, the same version, when Apple has removed its App ID (a free team removes them after 7 days)', async () => {
    expect(
      await harnessWith(
        marked(VALID),
        undefined,
        [],
        ['com.other.app']
      ).engine.refreshPlan({
        udid: UDID,
        accountId: ACCOUNT,
        bundleIds: [APP]
      })
    ).toEqual([{ bundleId: APP, kind: 'reinstall', reason: 'app-id' }])
  })

  it('installs SideStore again, alone or in LiveContainer, when its version can be downloaded again', async () => {
    // The test catalog has version 1.0 of every app.
    for (const appId of ['sidestore', 'livecontainer-sidestore'])
      expect(
        await harnessWith(
          marked(VALID, { kind: 'catalog', appId }),
          '1.0'
        ).engine.refreshPlan({
          udid: UDID,
          accountId: ACCOUNT,
          bundleIds: [APP]
        })
      ).toEqual([{ bundleId: APP, kind: 'reinstall', reason: 'sidestore' }])
  })

  it('gives SideStore a new profile only when its version is gone (an older Nightly): never another version', async () => {
    expect(
      await harnessWith(
        marked(VALID, { kind: 'catalog', appId: 'sidestore' }),
        '0.9'
      ).engine.refreshPlan({
        udid: UDID,
        accountId: ACCOUNT,
        bundleIds: [APP]
      })
    ).toEqual([{ bundleId: APP, kind: 'profile' }])
  })

  it('gives another catalog app a new profile only', async () => {
    expect(
      await harnessWith(
        marked(VALID, { kind: 'catalog', appId: 'livecontainer' })
      ).engine.refreshPlan({
        udid: UDID,
        accountId: ACCOUNT,
        bundleIds: [APP]
      })
    ).toEqual([{ bundleId: APP, kind: 'profile' }])
  })
})

describe('refreshApps', () => {
  it('puts new profiles for the app and its extension on the device and takes the old ones off, reinstalling nothing', async () => {
    const harness = harnessWith(marked(VALID))
    const run = harness.engine.refreshApps(
      { udid: UDID, accountId: ACCOUNT, profiles: [APP], apps: [] },
      { onPrompt: scripted() }
    )

    expect((await run.result).status).toBe('completed')
    expect(harness.apple.calls.profiles.sort()).toEqual([APP, WIDGET])
    expect(harness.devices.calls.installedProfiles).toHaveLength(2)
    expect(harness.devices.calls.removedProfiles.sort()).toEqual([
      'old-app',
      'old-widget'
    ])
    expect(harness.devices.calls.installs).toHaveLength(0)
    expect(harness.signer.calls.signed).toHaveLength(0)
  })

  it('gives an expired app whose profiles iOS removed new ones, for the App IDs of the app and its extension', async () => {
    const harness = harnessWith(marked(VALID), undefined, [])
    const run = harness.engine.refreshApps(
      { udid: UDID, accountId: ACCOUNT, profiles: [APP], apps: [] },
      { onPrompt: scripted() }
    )

    expect((await run.result).status).toBe('completed')
    expect(harness.apple.calls.profiles.sort()).toEqual([APP, WIDGET])
    expect(harness.devices.calls.installedProfiles).toHaveLength(2)
    expect(harness.devices.calls.installs).toHaveLength(0)
  })

  it('refuses to install a version other than the one on the device, installing nothing', async () => {
    // The test signer reads no version from the IPA, so it isn't 2.0.
    const harness = harnessWith(marked(VALID))
    const run = harness.engine.refreshApps(
      {
        udid: UDID,
        accountId: ACCOUNT,
        profiles: [],
        apps: [{ kind: 'catalog', appId: 'sidestore', version: '2.0' }]
      },
      { onPrompt: scripted() }
    )
    const result = await run.result

    expect(result.status === 'failed' && result.error.code).toBe(
      ErrorCode.VersionUnavailable
    )
    expect(harness.devices.calls.installs).toHaveLength(0)
  })
})

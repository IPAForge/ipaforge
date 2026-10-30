// The Apps page's Engine side: apps remembered after an install with their original IPA, listed from the device
// (its profiles say when each expires), refreshed from the kept IPA, and removed.
import { describe, expect, it, vi } from 'vitest'

import {
  ACCOUNT,
  bundlesFor,
  FREE_TEAM,
  installedApp,
  ipaFile,
  profile,
  sharesCertificate,
  UDID
} from '@installer/__tests__/fakes.ts'
import { createHarness, scripted } from '@installer/__tests__/harness.ts'
import {
  MARKER_KEY,
  markerFor,
  readMarker
} from '@installer/application/installed/marker.ts'
import { PromptKind } from '@installer/domain/prompts.ts'
import type { AppSource } from '@installer/domain/types.ts'
import { createDict, ErrorCode } from '@ipaforge/kernel'

vi.mock('@ipaforge/signer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ipaforge/signer')>()),
  exportPkcs12: vi.fn(() => new Uint8Array([0x30]))
}))

const APP = `com.example.app.${FREE_TEAM.id}`
const SIDESTORE = `com.SideStore.SideStore.${FREE_TEAM.id}`
const EXPIRES = new Date('2026-10-26T10:00:00Z')

/** A device that has the app installed, with this team's profile for it. */
const deviceWith = (...bundleIds: string[]) => ({
  installed: new Map(bundleIds.map((id) => [id, installedApp(id, 'App')])),
  profiles: bundleIds.map((id, index) => ({
    ...profile(`p${index}`, FREE_TEAM.id, id),
    expirationDate: EXPIRES
  }))
})

const install = async (
  harness: ReturnType<typeof createHarness>,
  apps: AppSource[]
) => {
  const run = harness.engine.installApps(
    { udid: UDID, accountId: ACCOUNT, apps },
    { onPrompt: scripted() }
  )

  expect((await run.result).status).toBe('completed')
}

describe('installed apps', () => {
  it('remembers an installed app with where it came from, and lists it with its expiry', async () => {
    const harness = createHarness({ device: deviceWith(APP) })

    await install(harness, [
      {
        kind: 'file',
        file: ipaFile('one.ipa'),
        origin: { kind: 'url', url: 'https://example.com/one.ipa' }
      }
    ])

    const [app] = await harness.engine.installedApps({
      udid: UDID,
      teamIds: [FREE_TEAM.id]
    })

    expect(app).toMatchObject({
      bundleId: APP,
      teamId: FREE_TEAM.id,
      expiresAt: EXPIRES,
      record: {
        originalBundleId: 'com.example.app',
        origin: { kind: 'url', url: 'https://example.com/one.ipa' }
      }
    })
  })

  it('lists apps signed with the team by another tool, without a record', async () => {
    const harness = createHarness({ device: deviceWith('com.other.tool') })

    expect(
      await harness.engine.installedApps({
        udid: UDID,
        teamIds: [FREE_TEAM.id]
      })
    ).toEqual([
      {
        bundleId: 'com.other.tool',
        name: 'App',
        teamId: FREE_TEAM.id,
        expiresAt: EXPIRES
      }
    ])
    expect(
      await harness.engine.installedApps({ udid: UDID, teamIds: ['OTHERTEAM'] })
    ).toEqual([])
  })

  it('lists an expired app whose profile iOS has removed, by the team at the end of its bundle id', async () => {
    const harness = createHarness({
      device: {
        installed: new Map([
          [APP, installedApp(APP, 'App')],
          ['com.example.store', installedApp('com.example.store', 'Store')]
        ])
      }
    })

    expect(
      await harness.engine.installedApps({
        udid: UDID,
        teamIds: [FREE_TEAM.id]
      })
    ).toEqual([
      {
        bundleId: APP,
        name: 'App',
        teamId: FREE_TEAM.id,
        profileGone: true
      }
    ])
  })

  it('refreshes from the kept IPA, keeping the certificate trust and the pairing file, without asking again', async () => {
    const harness = createHarness({ device: deviceWith(SIDESTORE) })

    await install(harness, [{ kind: 'catalog', appId: 'sidestore' }])

    const signedBefore = harness.signer.calls.signed.length
    const refresh = await harness.engine.installedSource(UDID, SIDESTORE)
    const prompts = scripted()
    const run = harness.engine.installApps(
      { udid: UDID, accountId: ACCOUNT, apps: [refresh] },
      { onPrompt: prompts }
    )
    const steps: string[] = []

    run.subscribe((event) => {
      if (event.type === 'step-completed') steps.push(event.stepId)
    })
    expect((await run.result).status).toBe('completed')
    expect(harness.catalog.calls.downloads).toBe(1)
    expect(sharesCertificate(harness.signer.calls.signed.at(-1))).toBe(true)
    expect(harness.signer.calls.signed).toHaveLength(signedBefore + 1)
    expect(steps).toContain('pairing-0')
    expect(prompts.asked.map((request) => request.kind)).not.toContain(
      PromptKind.ShareCertificate
    )
  })

  it("can't refresh an app it didn't install", async () => {
    const harness = createHarness({ device: deviceWith('com.other.tool') })

    await expect(
      harness.engine.installedSource(UDID, 'com.other.tool')
    ).rejects.toMatchObject({
      code: ErrorCode.KeptIpaMissing
    })
  })

  it('removes an app from the device and forgets it; a record whose app is gone is forgotten too', async () => {
    const harness = createHarness({ device: deviceWith(APP) })

    await install(harness, [{ kind: 'file', file: ipaFile('one.ipa') }])
    await harness.engine.removeApp({ udid: UDID, bundleId: APP })

    expect(harness.devices.calls.uninstalled).toEqual([APP])
    await expect(
      harness.engine.installedSource(UDID, APP)
    ).rejects.toMatchObject({
      code: ErrorCode.KeptIpaMissing
    })
  })

  it('marks the app itself with where it came from, so IPAForge on another computer knows it', async () => {
    const harness = createHarness({ device: deviceWith(APP) })

    await install(harness, [
      {
        kind: 'file',
        file: ipaFile('one.ipa'),
        origin: { kind: 'url', url: 'https://example.com/one.ipa' }
      }
    ])

    const main = harness.signer.calls.signed[0]
      ?.additions?.(bundlesFor('com.example.app'))
      .find((addition) => addition.bundlePath === '')

    expect(
      readMarker(main?.infoPlist ?? createDict(), {
        bundleId: APP,
        teamId: FREE_TEAM.id
      })
    ).toEqual({
      originalBundleId: 'com.example.app',
      origin: { kind: 'url', url: 'https://example.com/one.ipa' },
      // The certificate that signed it: what decides whether a refresh needs only new profiles.
      certificateSerial: expect.any(String)
    })
  })

  it('reads the mark from an app another computer installed (no record here)', async () => {
    const marked = {
      ...installedApp(APP, 'App'),
      raw: createDict([
        [
          MARKER_KEY,
          markerFor(
            'com.example.app',
            { kind: 'catalog', appId: 'sidestore', channel: 'stable' },
            'SERIAL1'
          )
        ]
      ])
    }
    const harness = createHarness({
      device: { ...deviceWith(APP), installed: new Map([[APP, marked]]) }
    })

    const [app] = await harness.engine.installedApps({
      udid: UDID,
      teamIds: [FREE_TEAM.id]
    })

    expect(app?.record).toBeUndefined()
    expect(app?.marker).toEqual({
      originalBundleId: 'com.example.app',
      origin: { kind: 'catalog', appId: 'sidestore', channel: 'stable' },
      certificateSerial: 'SERIAL1'
    })
  })

  it('ignores a mark that claims another app than the one it is in', async () => {
    const forged = {
      ...installedApp(APP, 'App'),
      raw: createDict([
        [
          MARKER_KEY,
          markerFor(
            'com.SideStore.SideStore',
            { kind: 'url', url: 'https://example.com/SideStore.ipa' },
            'SERIAL1'
          )
        ]
      ])
    }
    const harness = createHarness({
      device: { ...deviceWith(APP), installed: new Map([[APP, forged]]) }
    })

    const [app] = await harness.engine.installedApps({
      udid: UDID,
      teamIds: [FREE_TEAM.id]
    })

    expect(app?.marker).toBeUndefined()
  })
})

import { describe, expect, it, vi } from 'vitest'

import {
  ACCOUNT,
  FREE_TEAM,
  inspectionFor,
  ipaFile,
  sharesCertificate,
  UDID
} from '@installer/__tests__/fakes.ts'
import { createHarness, scripted } from '@installer/__tests__/harness.ts'
import { PromptKind } from '@installer/domain/prompts.ts'
import type { AppSource } from '@installer/domain/types.ts'
import { ErrorCode } from '@ipaforge/kernel'
import { DeviceFamily } from '@ipaforge/signer'

// Building SideStore's real .p12 needs a real certificate; the tests only check that SideStore gets one.
vi.mock('@ipaforge/signer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ipaforge/signer')>()),
  exportPkcs12: vi.fn(() => new Uint8Array([0x30]))
}))

const file = (name: string): AppSource => ({
  kind: 'file',
  file: ipaFile(name)
})
const install = (apps: AppSource[]) => ({
  udid: UDID,
  accountId: ACCOUNT,
  apps
})

describe('installApps', () => {
  it('installs catalog apps and files in sequence with one sign-in and one certificate', async () => {
    const h = createHarness()
    const result = await h.engine.installApps(
      install([
        file('one.ipa'),
        { kind: 'catalog', appId: 'sidestore' },
        file('two.ipa')
      ]),
      { onPrompt: scripted() }
    ).result
    expect(result.status).toBe('completed')
    expect(h.devices.calls.installs.map((f) => f.name)).toHaveLength(3)
    expect(h.apple.calls.created).toHaveLength(1)
    expect(h.signer.calls.signed.map((r) => r.newMainBundleId)).toEqual([
      `com.example.app.${FREE_TEAM.id}`,
      `com.SideStore.SideStore.${FREE_TEAM.id}`,
      `com.example.app.${FREE_TEAM.id}`
    ])
    // Only the checksum-verified catalog release gets the certificate.
    expect(h.signer.calls.signed.map((r) => sharesCertificate(r))).toEqual([
      false,
      true,
      false
    ])
    expect(h.signer.calls.bundles).toBe(0)
  })

  it('refuses a Refresh or Update download that is another app, before any Apple call', async () => {
    const h = createHarness()
    const wrong = await h.engine.installApps(
      install([
        {
          kind: 'file',
          file: ipaFile('other.ipa'),
          replaces: 'com.example.other'
        }
      ]),
      { onPrompt: scripted() }
    ).result

    expect(wrong.status).toBe('failed')
    if (wrong.status !== 'failed') return
    expect(wrong.failedStep).toBe('inspect-0')
    expect(wrong.error.code).toBe(ErrorCode.WrongApp)
    expect(h.apple.calls.created).toHaveLength(0)
    expect(h.devices.calls.installs).toHaveLength(0)

    const right = await h.engine.installApps(
      install([
        {
          kind: 'file',
          file: ipaFile('same.ipa'),
          replaces: 'com.example.app'
        }
      ]),
      { onPrompt: scripted() }
    ).result

    expect(right.status).toBe('completed')
  })

  it('gives SideStore from the catalog the pairing file, wherever it is in the list', async () => {
    const h = createHarness()
    const handle = h.engine.installApps(
      install([file('one.ipa'), { kind: 'catalog', appId: 'sidestore' }]),
      { onPrompt: scripted() }
    )
    const steps: string[] = []
    handle.subscribe((event) => {
      if (event.type === 'step-completed') steps.push(event.stepId)
    })
    const result = await handle.result

    expect(result.status).toBe('completed')
    expect(steps).toContain('pairing-1')
    expect(h.devices.calls.placed).toEqual([
      expect.arrayContaining([
        expect.objectContaining({
          bundleId: `com.SideStore.SideStore.${FREE_TEAM.id}`
        })
      ])
    ])
  })

  it('places no pairing file when no app needs one', async () => {
    const h = createHarness()
    const handle = h.engine.installApps(install([file('one.ipa')]), {
      onPrompt: scripted()
    })
    const skipped: string[] = []
    handle.subscribe((event) => {
      if (event.type === 'step-skipped' || event.type === 'step-completed')
        skipped.push(event.stepId)
    })
    await handle.result

    expect(skipped.some((id) => id.startsWith('pairing'))).toBe(false)
  })

  it('gives both SideStore and LiveContainer + SideStore the pairing file in one run', async () => {
    const h = createHarness()
    const result = await h.engine.installApps(
      install([
        { kind: 'catalog', appId: 'sidestore' },
        { kind: 'catalog', appId: 'livecontainer-sidestore' }
      ]),
      { onPrompt: scripted() }
    ).result

    expect(result.status).toBe('completed')
    expect(h.devices.calls.placed).toHaveLength(2)
  })

  it('checks the App ID budget for every app before provisioning any of them', async () => {
    const h = createHarness({
      apple: { appIdPlan: { enough: false, available: 1 } }
    })
    const result = await h.engine.installApps(
      install([file('one.ipa'), file('two.ipa')]),
      {
        onPrompt: scripted()
      }
    ).result
    expect(result.status === 'failed' && result.error.code).toBe(
      ErrorCode.AppIdQuotaExceeded
    )
    expect(h.apple.calls.provisioned).toEqual([])
  })

  it.each([
    ['approves', true, { kind: 'user-approved' }],
    ['declines', false, undefined]
  ])(
    'asks before sharing the certificate with an imported SideStore; the user %s',
    async (_label, answer, trust) => {
      const h = createHarness({
        signerIds: { 'mine.ipa': 'com.SideStore.SideStore' }
      })
      const prompts = scripted({ [PromptKind.ShareCertificate]: () => answer })
      const result = await h.engine.installApps(install([file('mine.ipa')]), {
        onPrompt: prompts
      }).result
      expect(result.status).toBe('completed')
      expect(prompts.asked.map((p) => p.kind)).toEqual([
        PromptKind.ShareCertificate
      ])
      expect(
        result.status === 'completed' && result.state.apps[0]?.trust
      ).toEqual(trust)
      expect(sharesCertificate(h.signer.calls.signed[0])).toBe(answer)
      expect(h.devices.calls.installs).toHaveLength(1)
    }
  )

  it('does not ask when an imported IPA only claims a SideStore bundle ID without holding SideStore', async () => {
    // LiveContainer without the SideStore framework has nowhere to put the certificate.
    const h = createHarness({
      signerIds: { 'lc.ipa': 'com.kdt.livecontainer' }
    })
    h.signer.signer.bundles = async () => [
      {
        path: '',
        kind: 'app',
        identifier: 'com.kdt.livecontainer',
        infoPlist: {},
        executable: 'x',
        depth: 0
      } as never
    ]
    const prompts = scripted()
    const result = await h.engine.installApps(install([file('lc.ipa')]), {
      onPrompt: prompts
    }).result
    expect(result.status).toBe('completed')
    expect(prompts.asked).toEqual([])
    expect(sharesCertificate(h.signer.calls.signed[0])).toBe(false)
  })

  it('stops at the inspect step of an app the device cannot run, before any Apple call', async () => {
    const h = createHarness({ device: { deviceClass: 'iPhone' } })
    h.signer.signer.inspect = async (source) => {
      const inspection = inspectionFor('com.example.app')
      const deviceFamilies =
        source.name === 'ipad.ipa'
          ? [DeviceFamily.IPad]
          : inspection.app.deviceFamilies

      return { ...inspection, app: { ...inspection.app, deviceFamilies } }
    }
    const result = await h.engine.installApps(
      install([file('one.ipa'), file('ipad.ipa')]),
      {
        onPrompt: scripted()
      }
    ).result

    expect(result.status === 'failed' && result.failedStep).toBe('inspect-1')
    expect(result.status === 'failed' && result.error).toMatchObject({
      code: ErrorCode.UnsupportedDevice,
      data: { deviceFamilies: [DeviceFamily.IPad], deviceClass: 'iPhone' }
    })
    expect(h.apple.calls.sessions).toBe(0)
    expect(h.apple.calls.provisioned).toEqual([])
    expect(h.devices.calls.installs).toEqual([])
  })

  it('refuses an empty list', () => {
    const h = createHarness()
    expect(() => h.engine.installApps(install([]))).toThrow()
  })

  it('saves the apps marked to save in the folder picked, signed without the private key, and installs the others', async () => {
    const h = createHarness()
    const result = await h.engine.installApps(
      {
        ...install([{ kind: 'catalog', appId: 'sidestore' }, file('one.ipa')]),
        save: { folder: '/Users/me/Signed', apps: [0] }
      },
      { onPrompt: scripted() }
    ).result

    expect(result.status).toBe('completed')
    expect(h.saved.map(({ folder, name }) => ({ folder, name }))).toEqual([
      { folder: '/Users/me/Signed', name: 'App.ipa' }
    ])
    expect(h.devices.calls.installs).toHaveLength(1)
    // SideStore saved to a folder doesn't carry the certificate's private key, nor gets a pairing file.
    expect(sharesCertificate(h.signer.calls.signed[0])).toBe(false)
    expect(h.devices.calls.placed).toEqual([])
    expect(h.scratch.keys.size).toBe(0)
    if (result.status !== 'completed') return
    expect(result.state.apps[0]?.savedTo).toBe('/Users/me/Signed/App.ipa')
    expect(result.state.apps[0]?.installed).toBeUndefined()
  })
})

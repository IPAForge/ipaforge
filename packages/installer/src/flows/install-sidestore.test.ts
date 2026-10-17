import { describe, expect, it, vi } from 'vitest'

import {
  ACCOUNT,
  certificateFor,
  FREE_TEAM,
  installedApp,
  OTHER_TEAM,
  profile,
  SHA256,
  twoFactorChallenge,
  UDID
} from '@installer/__tests__/fakes.ts'
import { createHarness, scripted } from '@installer/__tests__/harness.ts'
import { certificateKey } from '@installer/application/certificate-store.ts'
import { PromptKind } from '@installer/domain/prompts.ts'
import type { InstallState } from '@installer/domain/state.ts'
import type { RunEvent } from '@installer/engine/run-handle.ts'
import type { PipelineResult } from '@installer/pipeline/result.ts'
import { ErrorCode, LoadstarError } from '@loadstar/kernel'
import { exportPkcs12 } from '@loadstar/signer'

vi.mock('@loadstar/signer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@loadstar/signer')>()),
  exportPkcs12: vi.fn(() => new Uint8Array([0x30]))
}))

const SIDESTORE_ID = `com.SideStore.SideStore.${FREE_TEAM.id}`
const input = { udid: UDID, accountId: ACCOUNT, variant: 'sidestore' as const }

const completed = (result: PipelineResult<InstallState>): InstallState => {
  if (result.status !== 'completed') throw new Error(`run ${result.status}`)
  return result.state
}

const failedCode = (result: PipelineResult<InstallState>) =>
  result.status === 'failed' ? result.error.code : result.status

describe('installSideStore', () => {
  it('runs every step in order and installs SideStore with its certificate and pairing file', async () => {
    const h = createHarness()
    const events: RunEvent[] = []
    const run = h.engine.installSideStore(input, { onPrompt: scripted() })
    run.subscribe((event) => events.push(event))
    const state = completed(await run.result)

    const started = events.flatMap((event) =>
      event.type === 'step-started' ? [event.stepId] : []
    )
    expect(started).toEqual([
      'device',
      'resolve-0',
      'download-0',
      'inspect-0',
      'sign-in',
      'team',
      'register-device',
      'certificate',
      'app-ids',
      'free-apps-0',
      'provision-0',
      'sign-0',
      'install-0',
      'pairing',
      'remember'
    ])
    expect(events.at(-1)).toEqual({ type: 'progress', fraction: 1 })
    expect(h.catalog.calls.resolved).toEqual(['sidestore:stable'])
    expect(h.apple.calls.registered).toEqual([UDID])
    expect(
      h.apple.calls.provisioned[0]?.bundles.map((b) => b.identifier)
    ).toEqual([SIDESTORE_ID])
    expect(h.devices.calls.installs).toHaveLength(1)
    expect(h.devices.calls.placed).toEqual([
      [
        {
          bundleId: SIDESTORE_ID,
          path: 'Documents/PairingFile_Lockdown.plist'
        },
        {
          bundleId: SIDESTORE_ID,
          path: 'Documents/ALTPairingFile.mobiledevicepairing'
        }
      ]
    ])
    expect(h.devices.calls.closed).toBe(1)
    expect(h.scratch.keys.size).toBe(0)
    expect(h.apple.account().teamId).toBe(FREE_TEAM.id)
    expect(state.certificateSerial).toBe('SERIAL1')
    expect(h.secrets.values.has(certificateKey(ACCOUNT, FREE_TEAM.id))).toBe(
      true
    )
  })

  it('shares the certificate with the catalog release, stating catalog trust', async () => {
    const h = createHarness()
    completed(
      await h.engine.installSideStore(input, { onPrompt: scripted() }).result
    )
    const request = h.signer.calls.signed[0]
    expect(request?.teamId).toBe(FREE_TEAM.id)
    expect(request?.newMainBundleId).toBe(SIDESTORE_ID)
    const additions = request?.additions?.([
      {
        path: '',
        kind: 'app',
        identifier: 'com.SideStore.SideStore',
        infoPlist: {},
        executable: 'x',
        depth: 0
      }
    ] as never)
    expect(additions?.[0]?.files?.has('ALTCertificate.p12')).toBe(true)
    expect(exportPkcs12).toHaveBeenCalledWith(
      // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- the password derived from the fake machine ID
      expect.objectContaining({ password: 'machine-SERIAL1' })
    )
  })

  it('installs LiveContainer + SideStore and places the pairing file inside its SideStore', async () => {
    const h = createHarness()
    await h.engine.installSideStore(
      { ...input, variant: 'livecontainer', channel: 'nightly' },
      { onPrompt: scripted() }
    ).result
    const bundleId = `com.kdt.livecontainer.${FREE_TEAM.id}`
    expect(h.catalog.calls.resolved).toEqual([
      'livecontainer-sidestore:nightly'
    ])
    expect(h.devices.calls.placed[0]).toEqual([
      {
        bundleId,
        path: 'Documents/SideStore/Documents/PairingFile_Lockdown.plist'
      },
      {
        bundleId,
        path: 'Documents/SideStore/Documents/ALTPairingFile.mobiledevicepairing'
      }
    ])
  })

  it('asks for the 2FA code again after a wrong one, then saves the session', async () => {
    const challenge = twoFactorChallenge('123456')
    const h = createHarness({
      apple: { resume: async () => ({ kind: 'two_factor', challenge }) }
    })
    const codes = ['000000', '123456']
    const prompts = scripted({
      [PromptKind.TwoFactorCode]: () => codes.shift()
    })
    completed(
      await h.engine.installSideStore(input, { onPrompt: prompts }).result
    )
    expect(prompts.asked.map((p) => p.data?.retry)).toEqual([false, true])
    expect(challenge.codes).toEqual(['000000', '123456'])
    expect(h.apple.calls.saved).toBe(1)
  })

  it('asks for the password when the saved session expired and none is stored', async () => {
    const h = createHarness({
      apple: {
        resume: async () => ({ kind: 'needs_password', appleId: ACCOUNT })
      }
    })
    const prompts = scripted({ [PromptKind.Password]: () => 'secret' })
    completed(
      await h.engine.installSideStore(input, { onPrompt: prompts }).result
    )
    expect(prompts.asked.map((p) => p.kind)).toEqual([PromptKind.Password])
  })

  it('asks for the team only when there are several and none is remembered', async () => {
    const teams = [OTHER_TEAM, FREE_TEAM]
    const asking = createHarness({ apple: { teams } })
    const prompts = scripted({ [PromptKind.ChooseTeam]: () => FREE_TEAM.id })
    completed(
      await asking.engine.installSideStore(input, { onPrompt: prompts }).result
    )
    expect(prompts.asked.map((p) => p.kind)).toEqual([PromptKind.ChooseTeam])
    expect(asking.apple.account().teamId).toBe(FREE_TEAM.id)

    const remembered = createHarness({
      apple: { teams, rememberedTeam: OTHER_TEAM.id }
    })
    const state = completed(
      await remembered.engine.installSideStore(input, { onPrompt: scripted() })
        .result
    )
    expect(state.team).toEqual(OTHER_TEAM)
  })

  it('reuses the stored certificate on the next run instead of creating another', async () => {
    const h = createHarness()
    completed(
      await h.engine.installSideStore(input, { onPrompt: scripted() }).result
    )
    completed(
      await h.engine.installSideStore(input, { onPrompt: scripted() }).result
    )
    expect(h.apple.calls.created).toEqual(['SERIAL1'])
  })

  it('asks which certificate to revoke when the team is at its limit', async () => {
    const existing = [certificateFor('OLD1'), certificateFor('OLD2')]
    const h = createHarness({
      apple: { existingCertificates: existing, maxCertificates: 2 }
    })
    const prompts = scripted({ [PromptKind.RevokeCertificate]: () => 'OLD2' })
    const state = completed(
      await h.engine.installSideStore(input, { onPrompt: prompts }).result
    )
    expect(prompts.asked[0]?.data?.certificates).toEqual([
      { serialNumber: 'OLD1', machineName: 'Other' },
      { serialNumber: 'OLD2', machineName: 'Other' }
    ])
    expect(h.apple.calls.revoked).toEqual(['OLD2'])
    expect(state.certificateSerial).toBe('SERIAL1')
  })

  it('stops with the App ID quota error and the next free slot before provisioning anything', async () => {
    const nextSlotAt = new Date('2026-10-20T00:00:00Z')
    const h = createHarness({
      apple: { appIdPlan: { enough: false, available: 0, nextSlotAt } }
    })
    const result = await h.engine.installSideStore(input, {
      onPrompt: scripted()
    }).result
    expect(failedCode(result)).toBe(ErrorCode.AppIdQuotaExceeded)
    expect(result.status === 'failed' && result.error.data).toEqual({
      needed: 1,
      available: 0,
      nextSlotAt: nextSlotAt.toISOString()
    })
    expect(h.apple.calls.provisioned).toEqual([])
  })

  it('makes room under the free-app limit by removing the app the user picks', async () => {
    const apps = ['com.a', 'com.b', 'com.c']
    const h = createHarness({
      device: {
        profiles: [
          ...apps.map((id, i) => profile(`P${i}`, FREE_TEAM.id, id)),
          profile('PX', FREE_TEAM.id, 'com.b.widget')
        ],
        installed: new Map(
          apps.map((id) => [id, installedApp(id, id.toUpperCase())])
        )
      }
    })
    const prompts = scripted({ [PromptKind.ChooseAppToRemove]: () => 'com.b' })
    completed(
      await h.engine.installSideStore(input, { onPrompt: prompts }).result
    )
    expect(prompts.asked[0]?.data).toEqual({
      limit: 3,
      installing: SIDESTORE_ID,
      apps: apps.map((bundleId) => ({ bundleId, name: bundleId.toUpperCase() }))
    })
    expect(h.devices.calls.uninstalled).toEqual(['com.b'])
    expect(h.devices.calls.removedProfiles).toEqual(['P1', 'PX'])
  })

  it('does not count the app being reinstalled against the limit', async () => {
    const apps = ['com.a', 'com.b', SIDESTORE_ID]
    const h = createHarness({
      device: {
        profiles: apps.map((id, i) => profile(`P${i}`, FREE_TEAM.id, id)),
        installed: new Map(apps.map((id) => [id, installedApp(id)]))
      }
    })
    completed(
      await h.engine.installSideStore(input, { onPrompt: scripted() }).result
    )
    expect(h.devices.calls.uninstalled).toEqual([])
  })

  it('recovers once when installd still refuses for the free-app limit', async () => {
    const refusal = new LoadstarError(ErrorCode.FreeAppLimit, {
      data: { freeProfileApps: ['com.hidden', SIDESTORE_ID] }
    })
    const h = createHarness({ device: { installErrors: [refusal] } })
    const prompts = scripted({
      [PromptKind.ChooseAppToRemove]: () => 'com.hidden'
    })
    completed(
      await h.engine.installSideStore(input, { onPrompt: prompts }).result
    )
    expect(prompts.asked[0]?.data?.apps).toEqual([{ bundleId: 'com.hidden' }])
    expect(h.devices.calls.uninstalled).toEqual(['com.hidden'])
    expect(h.devices.calls.installs).toHaveLength(1)
  })

  it('marks the account banned on this device when Apple bans the profile', async () => {
    const h = createHarness({
      device: { installErrors: [new LoadstarError(ErrorCode.ProfileBanned)] }
    })
    const result = await h.engine.installSideStore(input, {
      onPrompt: scripted()
    }).result
    expect(failedCode(result)).toBe(ErrorCode.ProfileBanned)
    expect(h.apple.calls.banned).toEqual([UDID])
    expect(
      result.status === 'failed' && h.engine.classify(result.error).recovery
    ).toEqual(['switch-account'])
  })

  it.each([
    [{ locked: true }, ErrorCode.DeviceLocked],
    [{ developerMode: 'off' as const }, ErrorCode.DeveloperModeOff]
  ])('fails fast on the device preflight (%o)', async (device, code) => {
    const h = createHarness({ device })
    const result = await h.engine.installSideStore(input, {
      onPrompt: scripted()
    }).result
    expect(failedCode(result)).toBe(code)
    expect(result.status === 'failed' && result.failedStep).toBe('device')
    expect(h.catalog.calls.resolved).toEqual([])
  })

  it('deletes the signed IPA when the install fails, and signs again on resume', async () => {
    const h = createHarness({
      device: { installErrors: [new LoadstarError(ErrorCode.InstallFailed)] }
    })
    const failed = await h.engine.installSideStore(input).result
    expect(failed.status).toBe('failed')
    if (failed.status !== 'failed') return
    expect(failed.failedStep).toBe('install-0')
    expect(h.scratch.keys.size).toBe(0)

    completed(
      await h.engine.installSideStore(input, { resume: failed.checkpoint })
        .result
    )
    expect(h.signer.calls.signed).toHaveLength(2)
    expect(h.devices.calls.installs).toHaveLength(1)
    expect(h.scratch.keys.size).toBe(0)
  })

  it('resumes a cancelled run from its checkpoint without downloading again', async () => {
    const h = createHarness({ apple: { teams: [OTHER_TEAM, FREE_TEAM] } })
    const first = h.engine.installSideStore(input)
    const prompted = new Promise<void>((resolve) =>
      first.subscribe((event) => {
        if (event.type === 'prompt') resolve()
      })
    )
    await prompted
    expect(first.pending()?.kind).toBe(PromptKind.ChooseTeam)
    first.cancel()
    const cancelled = await first.result
    expect(cancelled.status).toBe('cancelled')
    if (cancelled.status !== 'cancelled') return
    expect(cancelled.checkpoint.completed).toEqual([
      'device',
      'resolve-0',
      'download-0',
      'inspect-0',
      'sign-in'
    ])

    const resumed = h.engine.installSideStore(input, {
      resume: cancelled.checkpoint,
      onPrompt: scripted({ [PromptKind.ChooseTeam]: () => FREE_TEAM.id })
    })
    completed(await resumed.result)
    expect(h.catalog.calls.downloads).toBe(1)
    expect(h.devices.calls.installs).toHaveLength(1)
  })

  it("stops at inspect, before any Apple call, when the device's iOS is too old for the release", async () => {
    const h = createHarness({ device: { productVersion: '15.8' } })
    const inspect = h.signer.signer.inspect
    h.signer.signer.inspect = async (file, signal) => {
      const inspection = await inspect(file, signal)

      return {
        ...inspection,
        app: { ...inspection.app, minimumOSVersion: '16.0' }
      }
    }
    const result = await h.engine.installSideStore(input, {
      onPrompt: scripted()
    }).result

    expect(result.status === 'failed' && result.failedStep).toBe('inspect-0')
    expect(result.status === 'failed' && result.error).toMatchObject({
      code: ErrorCode.UnsupportedIos,
      data: { minimumOSVersion: '16.0', iosVersion: '15.8' }
    })
    expect(h.apple.calls.sessions).toBe(0)
    expect(h.apple.calls.registered).toEqual([])
    expect(h.apple.calls.created).toEqual([])
    expect(h.apple.calls.provisioned).toEqual([])
    expect(h.devices.calls.installs).toEqual([])
  })

  it('answers prompts through the run handle', async () => {
    const h = createHarness({ apple: { teams: [OTHER_TEAM, FREE_TEAM] } })
    const run = h.engine.installSideStore(input)
    run.subscribe((event) => {
      if (event.type === 'prompt') run.answer(FREE_TEAM.id)
    })
    expect(completed(await run.result).team).toEqual(FREE_TEAM)
  })

  it('reports a declined prompt as installer.prompt_cancelled', async () => {
    const h = createHarness({ apple: { teams: [OTHER_TEAM, FREE_TEAM] } })
    const run = h.engine.installSideStore(input)
    run.subscribe((event) => {
      if (event.type === 'prompt') run.decline()
    })
    expect(failedCode(await run.result)).toBe(ErrorCode.PromptCancelled)
  })

  it('keeps the trust hash of the verified download', async () => {
    const h = createHarness()
    const state = completed(
      await h.engine.installSideStore(input, { onPrompt: scripted() }).result
    )
    expect(state.apps[0]?.trust).toEqual({
      kind: 'catalog',
      appId: 'sidestore',
      sha256: SHA256
    })
  })
})

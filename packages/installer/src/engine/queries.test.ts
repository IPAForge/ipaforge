import { describe, expect, it } from 'vitest'

import {
  ACCOUNT,
  FREE_TEAM,
  inspectionFor,
  installedApp,
  ipaFile,
  OTHER_TEAM,
  profile,
  UDID
} from '@installer/__tests__/fakes.ts'
import { createHarness } from '@installer/__tests__/harness.ts'
import { ErrorCode } from '@loadstar/kernel'

describe('engine queries', () => {
  it('previews an install without writing to Apple or the device', async () => {
    const h = createHarness({
      device: {
        profiles: [profile('P1', FREE_TEAM.id, 'com.a')],
        installed: new Map([['com.a', installedApp('com.a')]])
      },
      signerIds: { 'mine.ipa': 'com.SideStore.SideStore' }
    })
    const plan = await h.engine.planInstall({
      udid: UDID,
      accountId: ACCOUNT,
      source: { kind: 'file', file: ipaFile('mine.ipa') }
    })
    expect(plan.identity.newMainBundleId).toBe(
      `com.SideStore.SideStore.${FREE_TEAM.id}`
    )
    expect(plan.appIds.create).toEqual([plan.identity.newMainBundleId])
    expect(plan.freeSlots).toEqual({
      occupied: [{ bundleId: 'com.a' }],
      limit: 3
    })
    expect(plan.certificate).toEqual({
      stored: false,
      reusable: false,
      onTeam: 0
    })
    expect(plan.sharesCertificate).toBe(true)
    expect(plan.compatibility).toBeUndefined()
    expect(h.apple.calls.created).toEqual([])
    expect(h.apple.calls.registered).toEqual([])
    expect(h.apple.calls.provisioned).toEqual([])
    expect(h.devices.calls.uninstalled).toEqual([])
    expect(h.devices.calls.closed).toBe(1)
  })

  it('reports an app the device cannot run without failing the plan', async () => {
    const h = createHarness({ device: { deviceClass: 'iPad' } })
    h.signer.signer.inspect = async () => {
      const inspection = inspectionFor('com.example.legacy')

      return {
        ...inspection,
        app: { ...inspection.app, architectures: ['armv7'] }
      }
    }
    const plan = await h.engine.planInstall({
      udid: UDID,
      accountId: ACCOUNT,
      source: { kind: 'file', file: ipaFile('legacy.ipa') }
    })
    expect(plan.compatibility).toEqual({
      code: ErrorCode.NoArm64Build,
      data: { architectures: ['armv7'], supported: ['arm64', 'arm64e'] }
    })
    expect(plan.identity.newMainBundleId).toBe(
      `com.example.legacy.${FREE_TEAM.id}`
    )
    expect(h.apple.calls.provisioned).toEqual([])
  })

  it('never asks for a team: an open choice is installer.team_required', async () => {
    const h = createHarness({ apple: { teams: [FREE_TEAM, OTHER_TEAM] } })
    await expect(
      h.engine.appIdQuota({ accountId: ACCOUNT })
    ).rejects.toMatchObject({ code: ErrorCode.TeamRequired })
    const usage = await h.engine.appIdQuota({
      accountId: ACCOUNT,
      teamId: OTHER_TEAM.id
    })
    expect(usage.team).toEqual(OTHER_TEAM)
    expect(usage.quota.available).toBe(10)
  })
})

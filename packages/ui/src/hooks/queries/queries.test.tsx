import { waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import { renderAppHook } from '@ui/__tests__/hook-wrapper.tsx'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useAccounts } from '@ui/hooks/queries/use-accounts.ts'
import { useAppIdQuota } from '@ui/hooks/queries/use-app-id-quota.ts'
import { useCatalogApps } from '@ui/hooks/queries/use-catalog-apps.ts'
import { useCertificates } from '@ui/hooks/queries/use-certificates.ts'
import { useDeviceStatus } from '@ui/hooks/queries/use-device-status.ts'
import { uniqueDevices, useDevices } from '@ui/hooks/queries/use-devices.ts'
import { usePlanInstall } from '@ui/hooks/queries/use-plan-install.ts'
import { useRecommendedChannel } from '@ui/hooks/queries/use-recommended-channel.ts'
import { useTeams } from '@ui/hooks/queries/use-teams.ts'
import {
  FAKE_IPAD,
  FAKE_IPHONE,
  PERSONAL_TEAM
} from '@ui/services/engine/fake/fake-data.ts'

const WORK = 'work@example.com'

const settled = async <T,>(hook: () => { isPending: boolean } & T) => {
  const rendered = renderAppHook(hook)
  await waitFor(() => expect(rendered.result.current.isPending).toBe(false))
  return rendered.result.current
}

describe('query hooks over the fake Engine', () => {
  it('lists devices, accounts and catalog apps', async () => {
    expect((await settled(useDevices)).data?.map((d) => d.udid)).toEqual([
      FAKE_IPHONE,
      FAKE_IPAD
    ])
    expect((await settled(useAccounts)).data?.map((a) => a.id)).toEqual([
      WORK,
      'studio@example.com'
    ])
    expect((await settled(useCatalogApps)).data?.map((a) => a.id)).toEqual([
      'sidestore',
      'livecontainer-sidestore',
      'livecontainer',
      'stikdebug',
      'feather'
    ])
  })

  it('reads a device status, and surfaces a failure as an IPAForgeError with its code', async () => {
    const ready = await settled(() => useDeviceStatus(FAKE_IPHONE))
    expect(ready.data?.info.productVersion).toBe('26.1')

    const untrusted = await settled(() => useDeviceStatus(FAKE_IPAD))
    expect(untrusted.error).toBeInstanceOf(IPAForgeError)
    expect((untrusted.error as IPAForgeError).code).toBe(
      ErrorCode.DeviceNotPaired
    )
  })

  it('waits for a device or account before asking', () => {
    const { result } = renderAppHook(() => ({
      status: useDeviceStatus(undefined),
      teams: useTeams(undefined),
      quota: useAppIdQuota(undefined),
      certificates: useCertificates(undefined),
      plan: usePlanInstall(undefined)
    }))
    for (const query of Object.values(result.current))
      expect(query.fetchStatus).toBe('idle')
  })

  it("reads an account's teams, quota and certificates, and the recommended channel", async () => {
    expect((await settled(() => useTeams(WORK))).data).toEqual({
      kind: 'teams',
      teams: [PERSONAL_TEAM]
    })
    expect(
      (await settled(() => useAppIdQuota({ accountId: WORK }))).data?.quota
    ).toEqual({ max: 10, available: 8 })
    const certificates = await settled(() =>
      useCertificates({ accountId: WORK })
    )
    expect(certificates.data?.certificates[0]?.expiresAt).toBeInstanceOf(Date)
    expect(
      (await settled(() => useRecommendedChannel('sidestore', '26.1'))).data
    ).toBe('stable')
    expect(
      (
        await settled(() =>
          usePlanInstall({
            udid: FAKE_IPHONE,
            accountId: WORK,
            source: { kind: 'catalog', appId: 'sidestore' }
          })
        )
      ).data?.team
    ).toEqual(PERSONAL_TEAM)
  })

  it('answers "sign-in needed" for an expired session, as data rather than a failure', async () => {
    const rendered = renderAppHook(() => useTeams(WORK), {
      scenario: 'two-factor'
    })
    await waitFor(() =>
      expect(rendered.result.current.data).toEqual({ kind: 'sign-in-needed' })
    )
    expect(rendered.result.current.error).toBeNull()
  })

  it('keys every account query under the account, so one invalidation refreshes them all', () => {
    const accountKey = queryKeys.accounts[0]
    for (const key of [
      queryKeys.teams(WORK),
      queryKeys.appIdQuota({ accountId: WORK }),
      queryKeys.certificates({ accountId: WORK, teamId: 'T' })
    ])
      expect(key[0]).toBe(accountKey)
  })
})

describe('uniqueDevices', () => {
  it('lists a device on USB and Wi-Fi once, by its USB link', () => {
    const devices = uniqueDevices([
      { udid: 'A', deviceId: 1, connectionType: 'network' },
      { udid: 'A', deviceId: 2, connectionType: 'usb' },
      { udid: 'B', deviceId: 3, connectionType: 'network' }
    ])
    expect(devices.map((device) => device.deviceId)).toEqual([2, 3])
    expect(devices.map((device) => device.connections)).toEqual([
      ['network', 'usb'],
      ['network']
    ])
  })
})

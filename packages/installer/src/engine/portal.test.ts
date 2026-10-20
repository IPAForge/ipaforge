import { describe, expect, it } from 'vitest'

import {
  ACCOUNT,
  FREE_TEAM,
  installedApp,
  profile,
  UDID
} from '@installer/__tests__/fakes.ts'
import { createHarness } from '@installer/__tests__/harness.ts'
import { ErrorCode } from '@ipaforge/kernel'

const QUERY = { accountId: ACCOUNT, teamId: FREE_TEAM.id }

describe('the Developer Portal queries', () => {
  it('revokes a certificate of the team', async () => {
    const h = createHarness({
      apple: { existingCertificates: [{ serialNumber: 'AA' }] }
    })

    await h.engine.revokeCertificate(QUERY, 'AA')

    expect(h.apple.calls.revoked).toEqual(['AA'])
    expect((await h.engine.listCertificates(QUERY)).certificates).toEqual([])
  })

  it('deletes an App ID of the team, and refuses one it doesn’t have', async () => {
    const identifier = `com.example.game.${FREE_TEAM.id}`
    const h = createHarness({ apple: { appIds: [identifier] } })

    await h.engine.deleteAppId(QUERY, `id-${identifier}`)

    expect(h.apple.calls.deletedAppIds).toEqual([`id-${identifier}`])
    await expect(
      h.engine.deleteAppId(QUERY, 'id-missing')
    ).rejects.toMatchObject({ code: ErrorCode.AppIdUnavailable })
  })

  it('lists the team’s app groups and registered devices', async () => {
    const h = createHarness({ apple: { registeredDevices: [UDID] } })

    const groups = await h.engine.appGroups(QUERY)
    const devices = await h.engine.registeredDevices(QUERY)

    expect(groups.team.id).toBe(FREE_TEAM.id)
    expect(groups.groups.map((group) => group.name)).toEqual(['SideStore'])
    expect(devices.devices).toEqual([{ udid: UDID }])
  })

  it('lists the device’s profiles, used by an installed app or one of its extensions, or not', async () => {
    const app = `com.example.app.${FREE_TEAM.id}`
    const h = createHarness({
      device: {
        profiles: [
          profile('P1', FREE_TEAM.id, app),
          profile('P2', FREE_TEAM.id, `${app}.Widget`),
          profile('P3', FREE_TEAM.id, 'com.example.gone'),
          profile('P4', FREE_TEAM.id, '*')
        ],
        installed: new Map([[app, installedApp(app)]])
      }
    })

    const profiles = await h.engine.deviceProfiles(UDID)

    expect(
      profiles.map(({ uuid, bundleId, isUsed }) => ({ uuid, bundleId, isUsed }))
    ).toEqual([
      { uuid: 'P1', bundleId: app, isUsed: true },
      { uuid: 'P2', bundleId: `${app}.Widget`, isUsed: true },
      { uuid: 'P3', bundleId: 'com.example.gone', isUsed: false },
      { uuid: 'P4', isUsed: false }
    ])
    expect(h.devices.calls.closed).toBe(1)
  })

  it('removes profiles from the device', async () => {
    const h = createHarness()

    await h.engine.removeDeviceProfiles(UDID, ['P1', 'P2'])

    expect(h.devices.calls.removedProfiles).toEqual(['P1', 'P2'])
    expect(h.devices.calls.closed).toBe(1)
  })
})

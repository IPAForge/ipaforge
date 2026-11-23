import { describe, expect, it, vi } from 'vitest'

import type { DeveloperContext } from '@apple/application/developer/context.ts'
import { registerDevice } from '@apple/application/developer/devices.ts'
import type { DevicePlatform, Team } from '@apple/domain/types.ts'
import type { AppleDeps } from '@apple/types.ts'
import {
  createDict,
  ErrorCode,
  IPAForgeError,
  type PlistDict,
  silentLogger
} from '@ipaforge/kernel'

const team: Team = { id: 'TEAM1', name: 'Test', isFree: true }
const UDID = '00008110-000A1B2C3D4E401C'
const PHONE = { udid: UDID, name: 'Phone', platform: 'ios' } as const

const developerError = (action: string, resultCode: number) =>
  new IPAForgeError(ErrorCode.DeveloperRequestFailed, {
    data: { action, resultCode }
  })

/** A developer context whose `addDevice` answers with `addDevice()`; `listDevices` lists `listed`. */
const context = (
  addDevice: () => Promise<PlistDict>,
  listed: readonly string[] = []
) => {
  const teamRequest = vi.fn(
    async (
      _team: Team,
      action: string,
      _fields?: unknown,
      _platform?: DevicePlatform
    ) =>
      action === 'listDevices'
        ? createDict([
            [
              'devices',
              listed.map((udid) =>
                createDict([
                  ['deviceNumber', udid],
                  ['deviceId', 'D1'],
                  ['name', 'Phone']
                ])
              )
            ]
          ])
        : addDevice()
  )
  const ctx = {
    deps: { logger: silentLogger } as unknown as AppleDeps,
    request: vi.fn(),
    teamRequest,
    skip: () => () => {}
  } as unknown as DeveloperContext

  return { ctx, teamRequest }
}

describe('registerDevice', () => {
  it('does not add a device the team already lists', async () => {
    const { ctx, teamRequest } = context(
      async () => createDict(),
      [UDID.toLowerCase()]
    )
    expect(await registerDevice(ctx, team, PHONE)).toMatchObject({
      id: 'D1'
    })
    expect(teamRequest).toHaveBeenCalledTimes(1)
  })

  it('adds a device the team does not list', async () => {
    const { ctx } = context(async () =>
      createDict([
        [
          'device',
          createDict([
            ['deviceNumber', UDID],
            ['deviceId', 'D2'],
            ['name', 'Phone']
          ])
        ]
      ])
    )
    expect(await registerDevice(ctx, team, PHONE)).toMatchObject({
      udid: UDID,
      id: 'D2'
    })
  })

  it('carries on when Apple answers that the device is already registered (resultCode 35)', async () => {
    const { ctx } = context(async () => {
      throw developerError('addDevice', 35)
    })
    expect(await registerDevice(ctx, team, PHONE)).toEqual({
      udid: UDID,
      name: 'Phone'
    })
  })

  it('lists and adds an Apple TV under tvos/', async () => {
    const { ctx, teamRequest } = context(async () => createDict())
    await registerDevice(ctx, team, {
      udid: UDID,
      name: 'Living Room',
      platform: 'tvos'
    })
    expect(teamRequest.mock.calls.map((call) => [call[1], call[3]])).toEqual([
      ['listDevices', 'tvos'],
      ['addDevice', 'tvos']
    ])
  })

  it('still fails on any other addDevice error', async () => {
    const { ctx } = context(async () => {
      throw developerError('addDevice', 5405)
    })
    await expect(registerDevice(ctx, team, PHONE)).rejects.toThrow(
      IPAForgeError
    )
  })
})

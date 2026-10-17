// Teams and registered devices.

import type { DeveloperContext } from '@apple/application/developer/context.ts'
import {
  DeveloperCode,
  type RegisteredDevice,
  type Team
} from '@apple/domain/developer.ts'
import { toDevices, toTeams } from '@apple/infrastructure/developer/parse.ts'
import {
  createDict,
  ErrorCode,
  LoadstarError,
  type PlistDict
} from '@loadstar/kernel'

export const listTeams = async (ctx: DeveloperContext): Promise<Team[]> => {
  const teams = toTeams(await ctx.request('listTeams', 'any'), ctx.skip('team'))
  if (teams.length === 0) throw new LoadstarError(ErrorCode.NoTeams)
  return teams
}

export const listDevices = async (
  ctx: DeveloperContext,
  team: Team
): Promise<RegisteredDevice[]> =>
  toDevices(await ctx.teamRequest(team, 'listDevices'), ctx.skip('device'))

/**
 * Apple can answer `addDevice` with resultCode 35 for a device the team already has, even when `listDevices` did
 * not show it (a race with another tool, or a list that lags).
 */
const isAlreadyRegistered = (error: unknown): boolean =>
  error instanceof LoadstarError &&
  error.data?.action === 'addDevice' &&
  error.data.resultCode === DeveloperCode.InvalidName

const addDevice = async (
  ctx: DeveloperContext,
  team: Team,
  udid: string,
  name: string
): Promise<PlistDict | undefined> => {
  try {
    return await ctx.teamRequest(team, 'addDevice', [
      ['deviceNumber', udid],
      ['name', name]
    ])
  } catch (error) {
    if (!isAlreadyRegistered(error)) throw error
    ctx.deps.logger.info('device already registered on the team', {
      team: team.id
    })
    return undefined
  }
}

/** Registers the device unless it already is. */
export const registerDevice = async (
  ctx: DeveloperContext,
  team: Team,
  udid: string,
  name: string
): Promise<RegisteredDevice> => {
  const existing = (await listDevices(ctx, team)).find(
    (device) => device.udid.toLowerCase() === udid.toLowerCase()
  )
  if (existing) return existing
  const response = await addDevice(ctx, team, udid, name)
  if (!response) return { udid, name }
  ctx.deps.logger.info('registered device', { team: team.id })
  const added = toDevices(
    createDict([['devices', [response.device ?? createDict()]]]),
    ctx.skip('device')
  )

  return added[0] ?? { udid, name }
}

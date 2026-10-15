// Teams and registered devices.

import type { DeveloperContext } from '@apple/application/developer/context.ts'
import type { RegisteredDevice, Team } from '@apple/domain/developer.ts'
import { toDevices, toTeams } from '@apple/infrastructure/developer/parse.ts'
import { createDict, ErrorCode, LoadstarError } from '@loadstar/kernel'

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
  const response = await ctx.teamRequest(team, 'addDevice', [
    ['deviceNumber', udid],
    ['name', name]
  ])
  ctx.deps.logger.info('registered device', { team: team.id })
  const added = toDevices(
    createDict([['devices', [response.device ?? createDict()]]]),
    ctx.skip('device')
  )

  return added[0] ?? { udid, name }
}

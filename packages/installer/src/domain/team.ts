// Which team to use without asking: the one requested, else the one remembered for the account, else the only one.
import type { Team } from '@ipaforge/apple'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export type TeamPreference = {
  readonly requested?: string | undefined
  readonly remembered?: string | undefined
}

const requestedTeam = (teams: readonly Team[], requested: string): Team => {
  const team = teams.find((candidate) => candidate.id === requested)
  if (team) return team
  throw new IPAForgeError(ErrorCode.TeamRequired, {
    message: "the requested team is not one of the account's teams",
    data: { teams: teams.length }
  })
}

/** The team to use, or `undefined` when the user has to choose. */
export const preselectTeam = (
  teams: readonly Team[],
  preference: TeamPreference
): Team | undefined => {
  if (teams.length === 0) throw new IPAForgeError(ErrorCode.NoTeams)
  if (preference.requested) return requestedTeam(teams, preference.requested)
  const remembered = teams.find(
    (candidate) => candidate.id === preference.remembered
  )

  return remembered ?? (teams.length === 1 ? teams[0] : undefined)
}

/** Like `preselectTeam`, but a choice the user would have to make is an error (for queries, which never ask). */
export const requireTeam = (
  teams: readonly Team[],
  preference: TeamPreference
): Team => {
  const team = preselectTeam(teams, preference)
  if (team) return team
  throw new IPAForgeError(ErrorCode.TeamRequired, {
    data: { teams: teams.length }
  })
}

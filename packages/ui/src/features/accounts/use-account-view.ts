import { useTranslation } from 'react-i18next'

import type { StatusTone } from '@ui/components/shell/status-dot.tsx'
import {
  type AccountState,
  accountState,
  accountTone
} from '@ui/features/accounts/account-state.ts'
import { useTeams } from '@ui/hooks/queries/use-teams.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { Account } from '@ui/services/engine/engine-types.ts'

export type AccountView = {
  /** "Personal team (free) and Example Studio"; empty until Apple has answered. */
  readonly teams: string
  /** The teams, then the state when it is not ready ("… · Sign-in needed"). */
  readonly subtitle: string
  readonly state: AccountState | undefined
  /** The state in words, when it is not ready. */
  readonly stateText: string | undefined
  readonly tone: StatusTone
}

const NONE: AccountView = {
  teams: '',
  subtitle: '',
  state: undefined,
  stateText: undefined,
  tone: 'off'
}

/**
 * An Apple ID's teams and state on the devices in use, from the one teams query per account that every component
 * showing it shares. Without an account: nothing, "off".
 */
export const useAccountView = (
  account: Account | undefined,
  udids: readonly string[]
): AccountView => {
  const { t } = useTranslation()
  const { list } = useFormat()
  const teamsQuery = useTeams(account?.id)
  if (!account) return NONE
  const state = accountState(account, udids, teamsQuery)
  const answer = teamsQuery.data
  const teams = list(
    (answer?.kind === 'teams' ? answer.teams : []).map((team) =>
      team.isFree ? t('accounts.freeTeam', { name: team.name }) : team.name
    )
  )
  const stateText = state === 'ready' ? undefined : t(`accounts.state.${state}`)
  const subtitle = stateText
    ? t('accounts.withState', {
        line: teams || account.appleId,
        state: stateText
      })
    : teams

  return { teams, subtitle, state, stateText, tone: accountTone[state] }
}

import { useTranslation } from 'react-i18next'

import { accountTone } from '@ui/features/accounts/constants.ts'
import type { AccountView } from '@ui/features/accounts/types.ts'
import { accountState } from '@ui/features/accounts/utils/account-state.ts'
import { useTeams } from '@ui/hooks/queries/use-teams.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { Account } from '@ui/services/engine/types.ts'

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

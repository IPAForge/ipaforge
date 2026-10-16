import { skipToken, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** An account's teams; fails with `apple.session_expired` when the account needs signing in again. */
export const useTeams = (accountId: string | undefined) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.teams(accountId),
    queryFn: accountId ? () => engine.listTeams(accountId) : skipToken
  })
}

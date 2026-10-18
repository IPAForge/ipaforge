import { skipToken, useQuery } from '@tanstack/react-query'

import type { TeamQuery } from '@ipaforge/rpc'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** A team's App IDs and how many it can still register this week. */
export const useAppIdQuota = (query: TeamQuery | undefined) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.appIdQuota(query),
    queryFn: query ? () => engine.appIdQuota(query) : skipToken
  })
}

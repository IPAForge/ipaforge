import { skipToken, useQuery } from '@tanstack/react-query'

import type { TeamQuery } from '@ipaforge/rpc'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** A team's app groups (apps in one group share files). */
export const useAppGroups = (query: TeamQuery | undefined) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.appGroups(query),
    queryFn: query ? () => engine.appGroups(query) : skipToken
  })
}

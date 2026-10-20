import { skipToken, useQuery } from '@tanstack/react-query'

import type { TeamQuery } from '@ipaforge/rpc'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** The devices registered on a team (apps it signs run only on these). */
export const useRegisteredDevices = (query: TeamQuery | undefined) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.registeredDevices(query),
    queryFn: query ? () => engine.registeredDevices(query) : skipToken
  })
}

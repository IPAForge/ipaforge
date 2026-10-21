import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** The setup guide's check of this computer: read when the step opens, and again on Check again. */
export const useSystemCheck = () => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.systemCheck,
    queryFn: () => engine.systemCheck(),
    staleTime: 0,
    retry: false
  })
}

import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** App sources (built in and added) with what was last read from each. */
export const useSources = () => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.sourceList,
    queryFn: () => engine.listSources()
  })
}

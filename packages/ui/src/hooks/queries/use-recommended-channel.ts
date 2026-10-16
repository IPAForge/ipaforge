import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** The channel the catalog recommends for an app on this iOS version. */
export const useRecommendedChannel = (
  appId: string,
  iosVersion: string | undefined
) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.recommendedChannel(appId, iosVersion),
    queryFn: () => engine.recommendedChannel(appId, iosVersion)
  })
}

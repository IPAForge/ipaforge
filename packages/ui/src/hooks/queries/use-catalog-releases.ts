import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** A catalog app's latest release on each of its channels (its details), read from GitHub when they open. */
export const useCatalogReleases = (appId: string) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.catalogReleases(appId),
    queryFn: () => engine.catalogReleases(appId),
    retry: false
  })
}

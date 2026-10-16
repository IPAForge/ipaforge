import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** What the catalog can install. */
export const useCatalogApps = () => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.catalogApps,
    queryFn: () => engine.catalogApps()
  })
}

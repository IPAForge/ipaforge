import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** The apps of every AltStore-format source that's on; the Engine reads a source again when its copy is old. */
export const useSourceApps = () => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.sourceApps,
    queryFn: () => engine.sourceApps()
  })
}

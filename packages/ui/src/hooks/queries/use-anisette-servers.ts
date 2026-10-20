import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** The anisette servers in the order Automatic tries them, the choice, and SideStore's list's age. */
export const useAnisetteServers = () => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.anisette,
    queryFn: () => engine.anisetteServers()
  })
}

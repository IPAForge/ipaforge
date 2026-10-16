import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** The saved Apple IDs. */
export const useAccounts = () => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => engine.listAccounts()
  })
}

import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** Whether saved Apple IDs outlast the app: false without an OS keychain, or when access to it was denied. */
export const useCanSaveAccounts = () => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.canSaveAccounts,
    queryFn: () => engine.canSaveAccounts()
  })
}

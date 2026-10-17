import { useMutation, useQueryClient } from '@tanstack/react-query'

import { forgetSignedOutAccount } from '@ui/hooks/queries/account-cache.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/**
 * Forgets a saved Apple ID through the Engine, then drops everything cached about it and reads the saved list
 * again (accounts have no change feed).
 */
export const useSignOut = () => {
  const engine = useEngine()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (accountId: string) => engine.signOut(accountId),
    onSuccess: (_result, accountId) =>
      forgetSignedOutAccount(queryClient, accountId)
  })
}

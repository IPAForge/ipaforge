// What an account's sign-in and sign-out do to the query cache. Its answers are cached as data ("sign-in needed"
// included), so a sign-in resets them (the UI shows "Checking…" until Apple answers again, never the old state),
// and a sign-out removes them, so nothing asks the Engine about an account it no longer has.
import type { QueryClient } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import type { Account } from '@ui/services/engine/types.ts'

/** The saved list, read again; the account-scoped queries under it are left alone (`exact`). */
const refreshAccountList = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts, exact: true })

export const resetSignedInAccount = async (
  queryClient: QueryClient,
  accountId: string
): Promise<void> => {
  await Promise.all([
    queryClient.resetQueries({ queryKey: queryKeys.account(accountId) }),
    refreshAccountList(queryClient)
  ])
}

export const forgetSignedOutAccount = async (
  queryClient: QueryClient,
  accountId: string
): Promise<void> => {
  // Out of the list first, so no component showing it is left to ask about it.
  queryClient.setQueryData<Account[]>(queryKeys.accounts, (accounts) =>
    accounts?.filter((account) => account.id !== accountId)
  )
  queryClient.removeQueries({ queryKey: queryKeys.account(accountId) })
  await refreshAccountList(queryClient)
}

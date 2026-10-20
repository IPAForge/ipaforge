import { useQueryClient } from '@tanstack/react-query'

import type { PortalContext } from '@ui/features/developer/types.ts'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'

/** Reads everything the page shows again: what the Apple ID's teams hold at Apple, and the device's apps and profiles. */
export const usePortalRefresh = (context: PortalContext) => {
  const client = useQueryClient()
  const accountId = context.account?.id

  return () =>
    Promise.all([
      accountId
        ? client.invalidateQueries({ queryKey: queryKeys.account(accountId) })
        : undefined,
      client.invalidateQueries({ queryKey: queryKeys.apps })
    ])
}

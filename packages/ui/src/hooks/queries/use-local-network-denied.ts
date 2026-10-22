import { skipToken, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'

/**
 * Whether the OS refuses IPAForge local network access (macOS), as the device feed last said: false until it does.
 * Never fetched: only the feed writes it, so nothing can overwrite what the feed said.
 */
export const useLocalNetworkDenied = (): boolean => {
  const { data } = useQuery<boolean>({
    queryKey: queryKeys.localNetworkDenied,
    queryFn: skipToken,
    staleTime: Number.POSITIVE_INFINITY
  })

  return data ?? false
}

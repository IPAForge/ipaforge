import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { LogLevel } from '@ipaforge/kernel'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** Whether the Engine records debug lines; switching it on lasts until the app restarts. */
export const useDebugDetails = () => {
  const engine = useEngine()
  const queryClient = useQueryClient()
  const level = useQuery({
    queryKey: queryKeys.logLevel,
    queryFn: () => engine.logs.level(),
    staleTime: Number.POSITIVE_INFINITY
  })
  const change = useMutation({
    mutationFn: (next: LogLevel) => engine.logs.setLevel(next),
    onSuccess: (_result, next) =>
      queryClient.setQueryData(queryKeys.logLevel, next)
  })

  return {
    isOn: level.data === 'debug',
    isPending: level.isPending || change.isPending,
    set: (isOn: boolean) => change.mutate(isOn ? 'debug' : 'info')
  }
}

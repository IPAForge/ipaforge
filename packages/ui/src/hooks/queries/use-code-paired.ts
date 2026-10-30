import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** The Apple TVs and Vision Pros paired by code, on the network or not. Read again after a pairing or forget. */
export const useCodePairedDevices = () => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.codePaired,
    queryFn: () => engine.codePairedDevices()
  })
}

/** Forgets an Apple TV or Vision Pro paired by code, then reads the list again. */
export const useForgetCodePaired = () => {
  const engine = useEngine()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (udid: string) => engine.forgetCodePaired(udid),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.codePaired })
  })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** Asks the device to trust this computer again (the Trust prompt shows on it); its status is the answer. */
export const usePairDevice = (udid: string) => {
  const engine = useEngine()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => engine.pairDevice(udid),
    onSuccess: (check) =>
      queryClient.setQueryData(queryKeys.deviceStatus(udid), check),
    onError: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.deviceStatus(udid) })
  })
}

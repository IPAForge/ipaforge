import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** Deletes an app from the device (and IPAForge forgets it); the Apps list is read again after. */
export const useRemoveApp = () => {
  const engine = useEngine()
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: { udid: string; bundleId: string }) =>
      engine.removeApp(input),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.apps })
  })
}

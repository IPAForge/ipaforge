import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** Placing and removing an app's pairing file, and a new remote pairing; each reads the pairing files again. */
export const usePairingActions = (
  udid: string | undefined,
  teamIds: readonly string[]
) => {
  const engine = useEngine()
  const client = useQueryClient()
  const onSettled = () =>
    client.invalidateQueries({
      queryKey: queryKeys.pairingFiles(udid, teamIds)
    })

  return {
    place: useMutation({
      mutationFn: (target: { bundleId: string; path?: string }) =>
        udid
          ? engine.placeAppPairing({ udid, teamIds, ...target })
          : Promise.resolve(),
      onSettled
    }),
    remove: useMutation({
      mutationFn: (bundleId: string) =>
        udid
          ? engine.removeAppPairing({ udid, teamIds, bundleId })
          : Promise.resolve(),
      onSettled
    }),
    newRemote: useMutation({
      mutationFn: () =>
        udid ? engine.newRemotePairing({ udid, teamIds }) : Promise.resolve(),
      onSettled
    })
  }
}

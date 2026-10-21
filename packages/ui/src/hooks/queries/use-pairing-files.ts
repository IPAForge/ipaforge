import { skipToken, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/**
 * The device's pairing apps and the other apps IPAForge installed, with whose pairing files each holds. Read from the
 * device while it is connected; refreshed when a run ends and after each change.
 */
export const usePairingFiles = (
  udid: string | undefined,
  teamIds: readonly string[],
  isConnected: boolean
) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.pairingFiles(udid, teamIds),
    queryFn:
      udid && isConnected && teamIds.length > 0
        ? () => engine.pairingFiles({ udid, teamIds })
        : skipToken
  })
}

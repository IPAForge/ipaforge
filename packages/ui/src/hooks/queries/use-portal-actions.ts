import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { TeamQuery } from '@ipaforge/rpc'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/**
 * The Developer Portal's changes: revoking a certificate, deleting an App ID, removing profiles from a device. Each
 * reads again what it changed (and, for a certificate, the installed apps it signed).
 */
export const usePortalActions = (
  query: TeamQuery | undefined,
  udid: string | undefined
) => {
  const engine = useEngine()
  const client = useQueryClient()

  return {
    revoke: useMutation({
      mutationFn: (serialNumber: string) =>
        query
          ? engine.revokeCertificate(query, serialNumber)
          : Promise.resolve(),
      onSettled: () =>
        Promise.all([
          client.invalidateQueries({
            queryKey: queryKeys.certificates(query)
          }),
          client.invalidateQueries({ queryKey: queryKeys.apps })
        ])
    }),
    deleteAppId: useMutation({
      mutationFn: (appIdId: string) =>
        query ? engine.deleteAppId(query, appIdId) : Promise.resolve(),
      onSettled: () =>
        client.invalidateQueries({ queryKey: queryKeys.appIdQuota(query) })
    }),
    removeProfiles: useMutation({
      mutationFn: (uuids: readonly string[]) =>
        udid ? engine.removeDeviceProfiles(udid, uuids) : Promise.resolve(),
      onSettled: () =>
        client.invalidateQueries({ queryKey: queryKeys.deviceProfiles(udid) })
    })
  }
}

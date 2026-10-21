import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { TeamQuery } from '@ipaforge/rpc'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'

/**
 * The team's certificate as a .p12: exporting this computer's (saved where the user chooses, as
 * `IPAForge-<serial>.p12`), and importing one made elsewhere, which then shows as this computer's.
 */
export const useCertificateTransfer = (query: TeamQuery | undefined) => {
  const engine = useEngine()
  const { files } = useUiServices()
  const client = useQueryClient()

  return {
    exportP12: useMutation({
      mutationFn: async ({
        password,
        serialNumber
      }: {
        password: string
        serialNumber: string
      }) => {
        if (!query) return
        await files.save(
          `IPAForge-${serialNumber}.p12`,
          await engine.exportCertificate(query, password)
        )
      }
    }),
    importP12: useMutation({
      mutationFn: ({
        bytes,
        password
      }: {
        bytes: Uint8Array
        password: string
      }) =>
        query
          ? engine.importCertificate(query, bytes, password)
          : Promise.resolve(undefined),
      onSettled: () =>
        client.invalidateQueries({ queryKey: queryKeys.certificates(query) })
    })
  }
}

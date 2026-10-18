import { skipToken, useQuery } from '@tanstack/react-query'

import type { RemotePlanInstallInput } from '@ipaforge/rpc'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** A read-only preview of installing one app; it may download a catalog app first, so it runs only when asked. */
export const usePlanInstall = (input: RemotePlanInstallInput | undefined) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.planInstall(input),
    queryFn: input ? () => engine.planInstall(input) : skipToken
  })
}

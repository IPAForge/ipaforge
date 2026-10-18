import { skipToken, useQuery } from '@tanstack/react-query'

import type { TeamQuery } from '@ipaforge/rpc'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** A team's development certificates, whichever tool made them. */
export const useCertificates = (query: TeamQuery | undefined) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.certificates(query),
    queryFn: query ? () => engine.listCertificates(query) : skipToken
  })
}

import { skipToken, useQuery } from '@tanstack/react-query'

import { ErrorCode, LoadstarError } from '@loadstar/kernel'
import { QUERY_STALE_TIME_MS } from '@ui/hooks/queries/query-client.ts'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import type { Team } from '@ui/services/engine/engine-types.ts'

/**
 * What Apple said about an account's teams. An expired session is an answer, not a failure: it is cached like
 * the teams are, so the picker and the Accounts page agree and nothing asks Apple again just because a menu opened.
 */
export type TeamsAnswer =
  | { readonly kind: 'teams'; readonly teams: readonly Team[] }
  | { readonly kind: 'sign-in-needed' }

const isSessionExpired = (error: unknown): boolean =>
  error instanceof LoadstarError && error.code === ErrorCode.SessionExpired

/**
 * An account's teams (one query per account, shared by every component showing it). "Sign-in needed" stays until
 * the account signs in or out again (those invalidate the account's queries), or an explicit refresh.
 */
export const useTeams = (accountId: string | undefined) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.teams(accountId),
    queryFn: accountId
      ? async (): Promise<TeamsAnswer> => {
          try {
            return { kind: 'teams', teams: await engine.listTeams(accountId) }
          } catch (error) {
            if (isSessionExpired(error)) return { kind: 'sign-in-needed' }
            throw error
          }
        }
      : skipToken,
    staleTime: (query) =>
      query.state.data?.kind === 'sign-in-needed'
        ? Number.POSITIVE_INFINITY
        : QUERY_STALE_TIME_MS,
    // Another failure is not retried just because another component showing the account mounted.
    retryOnMount: false
  })
}

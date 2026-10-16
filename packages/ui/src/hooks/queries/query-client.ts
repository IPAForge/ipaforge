// The query cache's defaults, following the data rule in docs/design/conventions.md ("Live data: push, not
// polling"): live state arrives as events and is written into the cache; everything else is fetched when a screen
// needs it and kept, never refetched on a timer, on window focus or on reconnect (those queries hit Apple or GitHub).
import { QueryClient } from '@tanstack/react-query'

/** How long fetched data counts as fresh: a screen opened again within this time reuses it. */
export const QUERY_STALE_TIME_MS = 5 * 60 * 1000

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Engine errors are catalogued answers (a locked device, an expired session), not glitches to retry.
        retry: false,
        staleTime: QUERY_STALE_TIME_MS,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false
      }
    }
  })

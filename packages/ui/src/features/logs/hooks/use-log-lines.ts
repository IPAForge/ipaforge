import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  type LogEntry,
  type LogFilter,
  type LogLevel,
  type LogPage,
  matchesLogFilter
} from '@loadstar/kernel'
import { LOG_PAGE_SIZE } from '@ui/features/logs/constants.ts'
import { useLiveEntries } from '@ui/features/logs/hooks/use-live-entries.ts'
import type { LogLines } from '@ui/features/logs/types.ts'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

const NO_COUNTS: Readonly<Record<LogLevel, number>> = {
  debug: 0,
  info: 0,
  warn: 0,
  error: 0
}

const addCounts = (
  counts: Readonly<Record<LogLevel, number>>,
  entries: readonly LogEntry[]
) => {
  const total = { ...counts }
  for (const entry of entries) total[entry.level]++
  return total
}

/**
 * The lines for a filter: the newest page from the Engine (searched and filtered there), older pages as the list
 * scrolls up, then each new matching line as the Engine pushes it. Nothing is kept between visits to Logs.
 */
export const useLogLines = (filter: LogFilter): LogLines => {
  const engine = useEngine()
  const live = useLiveEntries()
  const {
    data,
    hasNextPage,
    isPending,
    isFetchingNextPage,
    isError,
    fetchNextPage
  } = useInfiniteQuery({
    queryKey: queryKeys.logs(filter),
    queryFn: ({ pageParam }) =>
      engine.logs.page({
        ...filter,
        limit: LOG_PAGE_SIZE,
        ...(pageParam === undefined ? {} : { before: pageParam })
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page: LogPage) =>
      page.hasMore ? page.entries[0]?.seq : undefined,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0
  })
  const pages = data?.pages

  const loaded = useMemo(() => {
    const newest = pages?.[0]
    const newestSeq = newest?.entries.at(-1)?.seq ?? 0
    // Lines that arrived after the first page, filtered like the Engine filters; the level aside for the counts.
    const arrived = newest ? live.filter((entry) => entry.seq > newestSeq) : []
    const countable = arrived.filter((entry) =>
      matchesLogFilter(entry, { ...filter, minLevel: 'debug' })
    )
    const older = [...(pages ?? [])].reverse().flatMap((page) => page.entries)

    return {
      entries: [
        ...older,
        ...countable.filter((entry) => matchesLogFilter(entry, filter))
      ],
      counts: addCounts(newest?.counts ?? NO_COUNTS, countable),
      lastSeq: Math.max(newestSeq, live.at(-1)?.seq ?? 0)
    }
  }, [pages, live, filter])

  return {
    ...loaded,
    hasOlder: hasNextPage,
    isLoading: isPending,
    isLoadingOlder: isFetchingNextPage,
    isError,
    loadOlder: () => {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
    }
  }
}

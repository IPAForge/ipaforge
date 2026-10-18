// The last records in memory, for the in-app log viewer. Records arrive redacted (the logger does that), so the
// buffer keeps them as they are. Readers page through it newest first and filter here, so a viewer never has to
// hold the whole buffer.
import {
  LOG_BUFFER_CAPACITY,
  LOG_PAGE_MAX,
  LOG_PAGE_SIZE
} from '@kernel/logging/constants.ts'
import {
  matchesExceptLevel,
  meetsLevel,
  searchText
} from '@kernel/logging/log-filter.ts'
import type {
  LogBuffer,
  LogEntry,
  LogPage,
  LogPageQuery
} from '@kernel/logging/types.ts'
import type { LogLevel } from '@kernel/ports/types.ts'

type Kept = { readonly entry: LogEntry; readonly haystack: string }

const emptyCounts = (): Record<LogLevel, number> => ({
  debug: 0,
  info: 0,
  warn: 0,
  error: 0
})

const pageLimit = (limit: number | undefined): number =>
  Math.min(Math.max(1, limit ?? LOG_PAGE_SIZE), LOG_PAGE_MAX)

export const createLogBuffer = (
  capacity: number = LOG_BUFFER_CAPACITY
): LogBuffer => {
  const kept: Kept[] = []
  const listeners = new Set<(entry: LogEntry) => void>()
  let seq = 0

  const notify = (entry: LogEntry): void => {
    for (const listener of listeners) {
      try {
        listener(entry)
      } catch {
        // a reader that throws must not stop the others, or the logging
      }
    }
  }

  const page = (query: LogPageQuery = {}): LogPage => {
    const limit = pageLimit(query.limit)
    const before = query.before ?? Number.POSITIVE_INFINITY
    const counts = emptyCounts()
    const entries: LogEntry[] = []
    let hasMore = false

    for (let index = kept.length - 1; index >= 0; index--) {
      const { entry, haystack } = kept[index] as Kept
      if (!matchesExceptLevel(entry, haystack, query)) continue
      counts[entry.level]++
      if (entry.seq >= before || !meetsLevel(entry, query)) continue
      if (entries.length < limit) entries.push(entry)
      else hasMore = true
    }

    return { entries: entries.reverse(), hasMore, counts }
  }

  return {
    sink: (record) => {
      const entry: LogEntry = { ...record, seq: ++seq }
      kept.push({ entry, haystack: searchText(entry) })
      if (kept.length > capacity) kept.shift()
      notify(entry)
    },
    page,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}

// The log viewer's requests, answered from the host's log buffer. Without one (a host that keeps no logs) the
// viewer gets empty pages and the default level.
import {
  compact,
  isLevelAtLeast,
  type LogLevel,
  type LogPage,
  type LogPageQuery,
  type LogRecord
} from '@ipaforge/kernel'
import type { LogSource } from '@rpc/domain/ports/log-source.ts'
import type { RemoteLogPageQuery } from '@rpc/domain/protocol/types.ts'

export type LogRequests = {
  page(query: RemoteLogPageQuery): LogPage
  level(next: LogLevel | undefined): LogLevel
  /** Keeps a record the UI logged, if the current level would have recorded it. */
  write(record: LogRecord): void
}

const NO_LOGS: LogPage = {
  entries: [],
  hasMore: false,
  counts: { debug: 0, info: 0, warn: 0, error: 0 }
}

const DEFAULT_LEVEL: LogLevel = 'info'

export const createLogRequests = (
  logs: LogSource | undefined
): LogRequests => ({
  page: (query) => logs?.buffer.page(compact(query) as LogPageQuery) ?? NO_LOGS,
  level: (next) => {
    if (next && logs) logs.level.set(next)
    return logs?.level.get() ?? DEFAULT_LEVEL
  },
  write: (record) => {
    if (logs && isLevelAtLeast(record.level, logs.level.get()))
      logs.buffer.sink(record)
  }
})

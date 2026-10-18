import { LEVEL_ORDER } from '@kernel/logging/constants.ts'
import type { LogEntry, LogFilter } from '@kernel/logging/types.ts'
import type { LogLevel } from '@kernel/ports/types.ts'

const SCOPE_SEPARATOR = '.'

const inScopes = (
  scope: string | undefined,
  scopes: readonly string[] | undefined
): boolean =>
  !scopes ||
  scopes.some(
    (wanted) =>
      scope === wanted || (scope ?? '').startsWith(wanted + SCOPE_SEPARATOR)
  )

const inTime = (ts: string, { from, to }: LogFilter): boolean =>
  (from === undefined || ts >= from) && (to === undefined || ts <= to)

/** The text an entry is searched in, lower-cased once when it arrives. */
export const searchText = (entry: LogEntry): string =>
  `${entry.msg} ${entry.scope ?? ''} ${JSON.stringify(entry.fields)}`.toLowerCase()

/** Whether an entry passes every part of the filter except its level (counted per level by the reader). */
export const matchesExceptLevel = (
  entry: LogEntry,
  haystack: string,
  filter: LogFilter
): boolean =>
  entry.seq > (filter.after ?? 0) &&
  inScopes(entry.scope, filter.scopes) &&
  inTime(entry.ts, filter) &&
  (!filter.text || haystack.includes(filter.text.toLowerCase()))

/** Whether a record at `level` is recorded by a logger set to `minLevel`. */
export const isLevelAtLeast = (level: LogLevel, minLevel: LogLevel): boolean =>
  LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel]

export const meetsLevel = (entry: LogEntry, filter: LogFilter): boolean =>
  isLevelAtLeast(entry.level, filter.minLevel ?? 'debug')

/** The whole filter, for an entry that arrives live. */
export const matchesLogFilter = (entry: LogEntry, filter: LogFilter): boolean =>
  meetsLevel(entry, filter) &&
  matchesExceptLevel(entry, searchText(entry), filter)

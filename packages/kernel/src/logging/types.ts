import type { LogLevel, LogRecord, LogSink } from '@kernel/ports/types.ts'

/** A record kept by a log buffer, numbered in the order it arrived (1, 2, 3…). */
export type LogEntry = LogRecord & { readonly seq: number }

/** Which entries a reader wants. Every field narrows; none means every entry. */
export type LogFilter = {
  /** The lowest level shown: `warn` keeps warnings and errors. */
  readonly minLevel?: LogLevel
  /** Scopes and everything under them: `device` matches `device` and `device.afc`. */
  readonly scopes?: readonly string[]
  /** Case-insensitive, in the message, the scope and the fields. */
  readonly text?: string
  /** ISO timestamps, both inclusive. */
  readonly from?: string
  readonly to?: string
  /** Only entries numbered above this one (what came after a clear). */
  readonly after?: number
}

/** A page of matching entries, newest first in the buffer, returned oldest first. */
export type LogPageQuery = LogFilter & {
  /** Only entries numbered below this one: the next page up. */
  readonly before?: number
  readonly limit?: number
}

export type LogPage = {
  readonly entries: readonly LogEntry[]
  /** Older matching entries are left for the next page. */
  readonly hasMore: boolean
  /** Matching entries per level, ignoring `minLevel` and paging, for the level filter's counts. */
  readonly counts: Readonly<Record<LogLevel, number>>
}

/** The last records in memory: a sink to log into, paged reads, and a live feed of what arrives. */
export type LogBuffer = {
  readonly sink: LogSink
  page(query?: LogPageQuery): LogPage
  /** Each entry as it arrives; returns the function that stops listening. */
  subscribe(listener: (entry: LogEntry) => void): () => void
}

/** A level that can change while the app runs; loggers built with `level: control.get` follow it. */
export type LogLevelControl = {
  get(): LogLevel
  set(level: LogLevel): void
}

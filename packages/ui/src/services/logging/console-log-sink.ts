import type { LogSink } from '@ipaforge/kernel'

/** The browser's log destination: the devtools console, one console method per level. */
export const consoleLogSink: LogSink = (record) =>
  console[record.level](`[${record.scope ?? '-'}] ${record.msg}`, record.fields)

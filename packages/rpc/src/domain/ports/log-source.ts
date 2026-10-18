import type { LogBuffer, LogLevelControl } from '@loadstar/kernel'

/** The host's log buffer and the level its loggers record at, served to the log viewer. */
export type LogSource = {
  readonly buffer: LogBuffer
  readonly level: LogLevelControl
}

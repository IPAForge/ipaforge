import {
  createLogBuffer,
  createLogger,
  createLogLevel,
  type Logger,
  parseLogLevel
} from '@loadstar/kernel'
import type { LogSource } from '@loadstar/rpc'

const MAIN_LOG_SCOPE = 'desktop'

export type MainLogging = {
  readonly logger: Logger
  /** What the log viewer reads: the last records, and the level the app records at. */
  readonly logs: LogSource
}

/**
 * The main process logger: `info` and up by default (LOG_LEVEL overrides, and the log viewer can switch to debug
 * until the app restarts), written to stderr and kept in memory for the log viewer.
 */
export const createMainLogging = (): MainLogging => {
  const buffer = createLogBuffer()
  const level = createLogLevel(parseLogLevel(process.env.LOG_LEVEL))
  const logger = createLogger({
    level: level.get,
    sink: (record) => {
      console.error(
        `[${record.level}] ${record.scope ?? ''} ${record.msg}`,
        record.fields
      )
      buffer.sink(record)
    },
    bindings: { scope: MAIN_LOG_SCOPE }
  })

  return { logger, logs: { buffer, level } }
}

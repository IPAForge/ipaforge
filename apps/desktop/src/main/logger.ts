import { createLogger, type Logger, parseLogLevel } from '@loadstar/kernel'

const MAIN_LOG_SCOPE = 'desktop'

/** The main process logger: `info` and up by default (LOG_LEVEL overrides), written to stderr. */
export const createMainLogger = (): Logger =>
  createLogger({
    level: parseLogLevel(process.env.LOG_LEVEL),
    sink: (record) =>
      console.error(
        `[${record.level}] ${record.scope ?? ''} ${record.msg}`,
        record.fields
      ),
    bindings: { scope: MAIN_LOG_SCOPE }
  })

import { LEVEL_ORDER } from '@kernel/logging/constants.ts'
import { DEFAULT_REDACT_PATTERN, redact } from '@kernel/logging/redact.ts'
import { compact } from '@kernel/objects/compact.ts'
import type { Clock } from '@kernel/ports/clock.ts'
import { systemClock } from '@kernel/ports/clock.ts'
import type {
  LogFields,
  Logger,
  LogLevel,
  LogRecord,
  LogSink
} from '@kernel/ports/types.ts'

const DEFAULT_LOG_LEVEL: LogLevel = 'info'
const SCOPE_SEPARATOR = '.'

export type CreateLoggerOptions = {
  /**
   * Minimum level emitted. Composition roots resolve it from `LOG_LEVEL` or settings; a function is read on every
   * record, so the level can change while the app runs (`createLogLevel`).
   */
  readonly level?: LogLevel | (() => LogLevel)
  readonly sink: LogSink
  /** Field-name pattern to mask; defaults to credentials, keys and device identifiers. */
  readonly redactPattern?: RegExp
  readonly clock?: Clock
  readonly bindings?: LogFields
}

export const parseLogLevel = (
  value: string | undefined,
  fallback: LogLevel = DEFAULT_LOG_LEVEL
): LogLevel => {
  const normalised = value?.trim().toLowerCase()

  return normalised && normalised in LEVEL_ORDER
    ? (normalised as LogLevel)
    : fallback
}

/** `parent.child`, skipping parts that are missing, empty or not strings. */
const joinScope = (parent: unknown, child: unknown): string | undefined => {
  const parts = [parent, child].filter(
    (part): part is string => typeof part === 'string' && part.length > 0
  )

  return parts.length ? parts.join(SCOPE_SEPARATOR) : undefined
}

/** Last resort when the sink throws: a broken sink must never break the operation being logged. */
const reportSinkFailure = (
  level: LogLevel,
  msg: string,
  error: unknown
): void => {
  try {
    console.error('[logger] sink failed', { level, msg, error })
  } catch {
    // nothing left to do
  }
}

/** Create a structured, redacting logger. It never throws, even when the sink does. */
export const createLogger = (options: CreateLoggerOptions): Logger => {
  const minLevel = options.level ?? DEFAULT_LOG_LEVEL
  const threshold = (): number =>
    LEVEL_ORDER[typeof minLevel === 'function' ? minLevel() : minLevel]
  const pattern = options.redactPattern ?? DEFAULT_REDACT_PATTERN
  const clock = options.clock ?? systemClock
  const bindings = options.bindings ?? {}

  const toRecord = (
    level: LogLevel,
    msg: string,
    fields?: LogFields
  ): LogRecord => {
    const { scope, ...rest } = { ...bindings, ...fields }

    return {
      ts: clock.now().toISOString(),
      level,
      scope: typeof scope === 'string' ? scope : undefined,
      msg,
      fields: redact(rest, pattern) as LogFields
    }
  }

  const emit = (level: LogLevel, msg: string, fields?: LogFields): void => {
    if (LEVEL_ORDER[level] < threshold()) return
    try {
      options.sink(toRecord(level, msg, fields))
    } catch (error) {
      reportSinkFailure(level, msg, error)
    }
  }

  return {
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
    child: (childBindings) => {
      const scope = joinScope(bindings.scope, childBindings.scope)

      return createLogger({
        ...options,
        bindings: { ...bindings, ...childBindings, ...compact({ scope }) }
      })
    }
  }
}

/** A logger that discards everything; the default when no logger is injected. */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger
}

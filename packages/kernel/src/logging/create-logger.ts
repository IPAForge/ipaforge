import { DEFAULT_REDACT_PATTERN, redact } from "@kernel/logging/redact.ts";
import type { Clock } from "@kernel/ports/clock.ts";
import { systemClock } from "@kernel/ports/clock.ts";
import type { LogFields, Logger, LogLevel, LogSink } from "@kernel/ports/logger.ts";

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface CreateLoggerOptions {
  /** Minimum level emitted. Composition roots resolve it from `LOG_LEVEL` or settings. */
  readonly level?: LogLevel;
  readonly sink: LogSink;
  /** Field-name pattern to mask; defaults to credentials, keys and device identifiers. */
  readonly redactPattern?: RegExp;
  readonly clock?: Clock;
  readonly bindings?: LogFields;
}

export const parseLogLevel = (value: string | undefined, fallback: LogLevel = "info"): LogLevel => {
  const normalised = value?.trim().toLowerCase();
  return normalised && normalised in LEVEL_ORDER ? (normalised as LogLevel) : fallback;
};

/** Create a structured, redacting logger. It never throws, even when the sink does. */
export const createLogger = (options: CreateLoggerOptions): Logger => {
  const threshold = LEVEL_ORDER[options.level ?? "info"];
  const pattern = options.redactPattern ?? DEFAULT_REDACT_PATTERN;
  const clock = options.clock ?? systemClock;
  const bindings = options.bindings ?? {};

  const emit = (level: LogLevel, msg: string, fields?: LogFields): void => {
    if (LEVEL_ORDER[level] < threshold) return;
    try {
      const { scope, ...rest } = { ...bindings, ...fields };
      options.sink({
        ts: clock.now().toISOString(),
        level,
        scope: typeof scope === "string" ? scope : undefined,
        msg,
        fields: redact(rest, pattern) as LogFields,
      });
    } catch (error) {
      // A broken sink must never break the operation being logged.
      try {
        console.error("[logger] sink failed", { level, msg, error });
      } catch {
        // nothing left to do
      }
    }
  };

  return {
    debug: (msg, fields) => emit("debug", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    error: (msg, fields) => emit("error", msg, fields),
    child: (childBindings) => {
      const scope = joinScope(bindings.scope, childBindings.scope);
      return createLogger({ ...options, bindings: { ...bindings, ...childBindings, ...(scope ? { scope } : {}) } });
    },
  };
};

/** A logger that discards everything; the default when no logger is injected. */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
};

const joinScope = (parent: unknown, child: unknown): string | undefined => {
  const parts = [parent, child].filter((part): part is string => typeof part === "string" && part.length > 0);
  return parts.length ? parts.join(".") : undefined;
};

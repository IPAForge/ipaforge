export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Readonly<Record<string, unknown>>;

/** Structured logger. Implementations must never throw. */
export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** A logger whose records carry extra bindings, e.g. `{ scope: "signer" }`. */
  child(bindings: LogFields): Logger;
}

export interface LogRecord {
  readonly ts: string;
  readonly level: LogLevel;
  readonly scope: string | undefined;
  readonly msg: string;
  readonly fields: LogFields;
}

/** Where log records go (console, file, in-app log viewer, …). Provided by composition roots. */
export type LogSink = (record: LogRecord) => void;

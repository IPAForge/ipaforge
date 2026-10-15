import { createLogger, type Logger, parseLogLevel } from "@loadstar/kernel";

/** The probes' logger: warnings and up by default (LOG_LEVEL overrides), written to stderr after `indent`. */
export const createProbeLogger = (indent = ""): Logger =>
  createLogger({
    level: parseLogLevel(process.env.LOG_LEVEL, "warn"),
    sink: (record) => console.error(`${indent}[${record.level}] ${record.scope ?? ""} ${record.msg}`, record.fields),
  });

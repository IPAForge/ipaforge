import type { LogLevel } from '@kernel/ports/types.ts'

/** Severity of each level; records below the logger's level are dropped. */
export const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
}

/** Masked wherever they appear in a key (`Password`, `sessionToken`, `privateKey`). */
export const SENSITIVE_WORDS = ['password', 'token', 'secret', 'private_?key']

/** Masked only as the whole key (`key` but not `bundleKey`), or as its prefix where marked `.*`. */
export const SENSITIVE_KEYS = [
  'key',
  'serial(?:_?number)?',
  'udid',
  'x-apple-i-md.*',
  'x-mme-device-id',
  'authorization',
  'cookie',
  'set-cookie'
]

/** How many records a log buffer keeps; older ones are dropped as new ones arrive. */
export const LOG_BUFFER_CAPACITY = 5000

/** Entries per page when a reader doesn't say, and the most it may ask for. */
export const LOG_PAGE_SIZE = 200
export const LOG_PAGE_MAX = 1000

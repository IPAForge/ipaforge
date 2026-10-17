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

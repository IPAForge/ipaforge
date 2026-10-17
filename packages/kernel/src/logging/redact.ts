export const REDACTED = '[redacted]'

/** Masked wherever they appear in a key (`Password`, `sessionToken`, `privateKey`). */
const SENSITIVE_WORDS = ['password', 'token', 'secret', 'private_?key']

/** Masked only as the whole key (`key` but not `bundleKey`), or as its prefix where marked `.*`. */
const SENSITIVE_KEYS = [
  'key',
  'serial(?:_?number)?',
  'udid',
  'x-apple-i-md.*',
  'x-mme-device-id',
  'authorization',
  'cookie',
  'set-cookie'
]

/**
 * Field names whose values are always masked, matched case-insensitively.
 * Covers credentials, key material, Apple anisette/device headers and device identifiers.
 */
export const DEFAULT_REDACT_PATTERN = new RegExp(
  `${SENSITIVE_WORDS.join('|')}|^(?:${SENSITIVE_KEYS.join('|')})$`,
  'i'
)

const MAX_DEPTH = 6

const errorShape = (error: Error): Record<string, unknown> => {
  const shape: Record<string, unknown> = {
    name: error.name,
    message: error.message
  }
  if (error.cause !== undefined) shape.cause = error.cause
  return shape
}

/** An error's own `toJSON()` (LoadstarError has one), or its name, message and cause. */
const errorToJson = (error: Error): unknown =>
  'toJSON' in error && typeof error.toJSON === 'function'
    ? error.toJSON()
    : errorShape(error)

const walk = (
  value: unknown,
  pattern: RegExp,
  depth: number,
  seen: WeakSet<object>
): unknown => {
  if (value === null || typeof value !== 'object')
    return typeof value === 'bigint' ? `${value}n` : value
  if (value instanceof Uint8Array || value instanceof ArrayBuffer)
    return `<${value.byteLength} bytes>`
  if (value instanceof Date) return value.toISOString()
  if (seen.has(value)) return '[circular]'
  if (depth >= MAX_DEPTH) return '[truncated]'
  seen.add(value)

  const walkChild = (child: unknown): unknown =>
    walk(child, pattern, depth + 1, seen)
  if (value instanceof Error) return walkChild(errorToJson(value))
  if (Array.isArray(value)) return value.map((item) => walkChild(item))
  if (value instanceof Map) return walkChild(Object.fromEntries(value))

  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value))
    out[key] = pattern.test(key) ? REDACTED : walkChild(item)
  return out
}

/**
 * Deep-copy `value` for logging: masks sensitive keys, summarises binary data, serialises
 * errors and breaks cycles. Never mutates the input.
 */
export const redact = (
  value: unknown,
  pattern: RegExp = DEFAULT_REDACT_PATTERN
): unknown => walk(value, pattern, 0, new WeakSet())

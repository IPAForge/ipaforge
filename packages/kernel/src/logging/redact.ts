export const REDACTED = "[redacted]";

/**
 * Field names whose values are always masked. Matched case-insensitively against the full key.
 * Covers credentials, key material, Apple anisette/device headers and device identifiers.
 */
export const DEFAULT_REDACT_PATTERN =
  /^(?:.*password.*|.*token.*|.*secret.*|.*private_?key.*|key|serial(?:_?number)?|udid|x-apple-i-md.*|x-mme-device-id|authorization|cookie|set-cookie)$/i;

const MAX_DEPTH = 6;

/**
 * Deep-copy `value` for logging: masks sensitive keys, summarises binary data, serialises
 * errors and breaks cycles. Never mutates the input.
 */
export const redact = (value: unknown, pattern: RegExp = DEFAULT_REDACT_PATTERN): unknown =>
  walk(value, pattern, 0, new WeakSet());

const walk = (value: unknown, pattern: RegExp, depth: number, seen: WeakSet<object>): unknown => {
  if (value === null || typeof value !== "object") return typeof value === "bigint" ? `${value}n` : value;
  if (value instanceof Uint8Array) return `<${value.byteLength} bytes>`;
  if (value instanceof ArrayBuffer) return `<${value.byteLength} bytes>`;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return "[circular]";
  if (depth >= MAX_DEPTH) return "[truncated]";
  seen.add(value);

  if (value instanceof Error) {
    const json = "toJSON" in value && typeof value.toJSON === "function" ? value.toJSON() : errorShape(value);
    return walk(json, pattern, depth + 1, seen);
  }
  if (Array.isArray(value)) return value.map((item) => walk(item, pattern, depth + 1, seen));
  if (value instanceof Map) return walk(Object.fromEntries(value), pattern, depth + 1, seen);

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = pattern.test(key) ? REDACTED : walk(item, pattern, depth + 1, seen);
  }
  return out;
};

const errorShape = (error: Error): Record<string, unknown> => {
  const shape: Record<string, unknown> = { name: error.name, message: error.message };
  if (error.cause !== undefined) shape.cause = error.cause;
  return shape;
};

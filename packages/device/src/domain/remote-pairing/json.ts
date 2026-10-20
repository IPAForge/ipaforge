// Reading remote pairing's JSON bodies, which nest every value one level deeper (`{event: {_0: {pairingData:
// {_0: …}}}}`): a guard for objects, and a path walk that returns undefined when any step is missing.

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The value at `path` (object keys, one after another), or undefined. */
export const valueAt = (value: unknown, path: readonly string[]): unknown =>
  path.reduce<unknown>(
    (node, key) => (isRecord(node) ? node[key] : undefined),
    value
  )

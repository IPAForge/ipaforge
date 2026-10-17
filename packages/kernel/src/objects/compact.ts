// `compact({ a, b: maybe })` drops undefined fields. With `exactOptionalPropertyTypes`, an optional field may be
// absent but not `undefined`; this keeps object literals readable instead of `...(b ? { b } : {})` everywhere.

import type { Compact } from '@kernel/objects/types.ts'

export const compact = <T extends object>(value: T): Compact<T> => {
  const out: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(value))
    if (field !== undefined) out[key] = field
  return out as Compact<T>
}

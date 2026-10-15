import { WILDCARD } from '@signer/domain/entitlements/names.ts'

export const isWildcard = (pattern: string): boolean =>
  pattern.endsWith(WILDCARD)

/** Exact match, or `PREFIX*` covering everything that starts with `PREFIX`. */
export const matchesPattern = (pattern: string, value: string): boolean =>
  pattern === value ||
  (isWildcard(pattern) && value.startsWith(pattern.slice(0, -WILDCARD.length)))

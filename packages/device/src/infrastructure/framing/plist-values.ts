import type { PlistValue } from '@loadstar/kernel'

/** A plist integer (decoded as `number`, or `bigint` past 2^53) as a number; `undefined` for anything else. */
export const plistInteger = (
  value: PlistValue | undefined
): number | undefined => {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  return undefined
}

// Typed reads of loosely typed plist values from Apple responses.
import type { PlistValue } from '@loadstar/kernel'

/** Apple sends integers as plist `integer`, which can parse to a number or a bigint. */
export const plistNumber = (
  value: PlistValue | undefined
): number | undefined => {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  return undefined
}

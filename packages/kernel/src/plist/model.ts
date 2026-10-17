/** A floating-point plist value. */
import type { PlistDict, PlistValue } from '@kernel/plist/types.ts'

export class PlistReal {
  readonly value: number

  constructor(value: number) {
    this.value = value
  }
}

export const real = (value: number): PlistReal => new PlistReal(value)

export const isPlistDict = (
  value: PlistValue | undefined
): value is PlistDict =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Uint8Array) &&
  !(value instanceof Date) &&
  !(value instanceof PlistReal)

/**
 * Builds a dict without a prototype, so keys such as `__proto__` from untrusted plists are
 * stored as ordinary data and can never pollute Object.prototype.
 */
export const createDict = (
  entries: Iterable<readonly [string, PlistValue]> = []
): PlistDict => {
  const dict: Record<string, PlistValue> = Object.create(null)
  for (const [key, value] of entries) {
    Object.defineProperty(dict, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true
    })
  }
  return dict
}

/** Returns a copy of `dict` with `key` set (immutable update that keeps the null prototype). */
export const withKey = (
  dict: PlistDict,
  key: string,
  value: PlistValue
): PlistDict =>
  createDict([...Object.entries(dict).filter(([k]) => k !== key), [key, value]])

export const stringAt = (dict: PlistDict, key: string): string | undefined => {
  const value = dict[key]

  return typeof value === 'string' ? value : undefined
}

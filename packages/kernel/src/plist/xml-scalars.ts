// Text forms of the XML plist scalars `<integer>`, `<real>` and `<date>`.

import { failXmlPlist as fail } from '@kernel/plist/xml-error.ts'

const INTEGER_PATTERN = /^[+-]?(?:\d+|0x[0-9a-f]+)$/i
const NAN_TEXT = 'nan'
const POSITIVE_INFINITY_TEXTS: ReadonlySet<string> = new Set([
  'inf',
  '+inf',
  'infinity',
  '+infinity'
])
const NEGATIVE_INFINITY_TEXTS: ReadonlySet<string> = new Set([
  '-inf',
  '-infinity'
])

const isSafe = (value: bigint): boolean =>
  value >= BigInt(Number.MIN_SAFE_INTEGER) &&
  value <= BigInt(Number.MAX_SAFE_INTEGER)

/** Decimal or hex integer; a `number` when it is safe, otherwise a `bigint`. */
export const parseInteger = (
  text: string,
  position: number
): number | bigint => {
  const trimmed = text.trim()
  if (!INTEGER_PATTERN.test(trimmed))
    return fail(`bad integer "${trimmed}"`, position)
  const magnitude = BigInt(trimmed.replace(/^[+-]/, ''))
  const value = trimmed.startsWith('-') ? -magnitude : magnitude

  return isSafe(value) ? Number(value) : value
}

/** A decimal number, or the CoreFoundation spellings of NaN and the infinities. */
export const parseReal = (text: string, position: number): number => {
  const trimmed = text.trim().toLowerCase()
  if (trimmed === NAN_TEXT) return Number.NaN
  if (POSITIVE_INFINITY_TEXTS.has(trimmed)) return Infinity
  if (NEGATIVE_INFINITY_TEXTS.has(trimmed)) return -Infinity
  const value = Number(trimmed)

  return Number.isNaN(value) ? fail(`bad real "${trimmed}"`, position) : value
}

export const parseDate = (text: string, position: number): Date => {
  const trimmed = text.trim()
  const date = new Date(trimmed)

  return Number.isNaN(date.getTime())
    ? fail(`bad date "${trimmed}"`, position)
    : date
}

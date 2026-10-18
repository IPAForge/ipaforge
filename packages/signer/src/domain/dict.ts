// Small immutable helpers over plist dictionaries.
import { createDict, type PlistDict, type PlistValue } from '@ipaforge/kernel'

/** The string items of an array value (anything else yields none). */
export const stringsOf = (value: PlistValue | undefined): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

/** A copy of `dict` with `key` set; an existing key keeps its position, a new one is appended. */
export const assignKey = (
  dict: PlistDict,
  key: string,
  value: PlistValue
): PlistDict =>
  createDict(
    key in dict
      ? Object.entries(dict).map(([name, current]) => [
          name,
          name === key ? value : current
        ])
      : [...Object.entries(dict), [key, value]]
  )

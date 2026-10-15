// Reads `UIDeviceFamily` from an Info.plist: a single integer or an array of them.
import type { PlistDict, PlistValue } from '@loadstar/kernel'
import { UI_DEVICE_FAMILY } from '@signer/domain/bundle/info-keys.ts'
import { DEFAULT_DEVICE_FAMILIES } from '@signer/domain/sideload/compatibility-constants.ts'

/** An integer family, also when a hand-written plist stores it as a string. */
const familyOf = (value: PlistValue): number | undefined => {
  const family = typeof value === 'string' ? Number.parseInt(value, 10) : value

  return typeof family === 'number' && Number.isInteger(family)
    ? family
    : undefined
}

const isFamily = (family: number | undefined): family is number =>
  family !== undefined

/** The declared families, or Apple's default (iPhone only) when none are declared. */
export const deviceFamiliesOf = (infoPlist: PlistDict): number[] => {
  const value = infoPlist[UI_DEVICE_FAMILY]
  if (value === undefined) return [...DEFAULT_DEVICE_FAMILIES]
  const families = (Array.isArray(value) ? value : [value])
    .map(familyOf)
    .filter(isFamily)

  return families.length > 0
    ? [...new Set(families)]
    : [...DEFAULT_DEVICE_FAMILIES]
}

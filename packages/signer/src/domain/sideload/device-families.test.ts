import { describe, expect, it } from 'vitest'

import { createDict, type PlistValue } from '@ipaforge/kernel'
import { deviceFamiliesOf } from '@signer/domain/sideload/device-families.ts'

const plistWith = (value: PlistValue | undefined) =>
  createDict(value === undefined ? [] : [['UIDeviceFamily', value]])

describe('deviceFamiliesOf', () => {
  it.each<[string, PlistValue | undefined, number[]]>([
    ["absent: Apple's default, iPhone only", undefined, [1]],
    ['an array', [1, 2], [1, 2]],
    ['a single integer', 2, [2]],
    ['integers written as strings', ['1', '2'], [1, 2]],
    ['duplicates', [2, 2], [2]],
    ['an empty array', [], [1]],
    ['nothing usable', ['iPad', true], [1]]
  ])('%s', (_label, value, expected) => {
    expect(deviceFamiliesOf(plistWith(value))).toEqual(expected)
  })
})

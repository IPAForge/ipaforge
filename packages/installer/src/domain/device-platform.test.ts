import { describe, expect, it } from 'vitest'

import { devicePlatform } from '@installer/domain/device-platform.ts'

describe('devicePlatform', () => {
  it.each([
    ['AppleTV', 'tvos'],
    ['iPhone', 'ios'],
    ['iPad', 'ios'],
    ['RealityDevice', 'ios']
  ])('a %s is provisioned under %s', (deviceClass, platform) => {
    expect(devicePlatform({ deviceClass })).toBe(platform)
  })

  it('treats an unknown device as an iPhone', () => {
    expect(devicePlatform(undefined)).toBe('ios')
  })
})

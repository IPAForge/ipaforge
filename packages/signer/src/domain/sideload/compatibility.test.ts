import { describe, expect, it } from 'vitest'

import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import {
  assertCompatible,
  checkCompatibility
} from '@signer/domain/sideload/compatibility.ts'
import type {
  InspectedApp,
  IpaInspection,
  TargetDevice
} from '@signer/domain/sideload/types.ts'

const IPHONE: TargetDevice = { iosVersion: '18.0', deviceClass: 'iPhone' }

const inspection = (app: Partial<InspectedApp> = {}): IpaInspection => ({
  app: {
    path: 'Payload/App.app',
    identifier: 'com.example.app',
    name: 'App',
    minimumOSVersion: '15.0',
    deviceFamilies: [1],
    architectures: ['arm64'],
    ...app
  },
  nested: [],
  appGroups: [],
  keychainAccessGroups: [],
  altAppGroups: []
})

describe('checkCompatibility', () => {
  it('accepts an app the device can run', () => {
    expect(checkCompatibility(inspection(), IPHONE)).toBeUndefined()
  })

  describe('minimum iOS', () => {
    it.each([
      ['15.0', '18.0', true],
      ['18.0', '18.0', true],
      ['18.0.1', '18.0', false],
      ['26.1', '18.7', false],
      ['9.3.5', '10.0', true],
      ['10.0', '9.3.5', false]
    ])(
      'an app needing iOS %s on iOS %s runs: %s',
      (minimumOSVersion, iosVersion, runs) => {
        const problem = checkCompatibility(inspection({ minimumOSVersion }), {
          ...IPHONE,
          iosVersion
        })
        expect(problem).toEqual(
          runs
            ? undefined
            : {
                code: ErrorCode.UnsupportedIos,
                data: { minimumOSVersion, iosVersion }
              }
        )
      }
    )

    it('passes an app that declares no minimum', () => {
      const app = inspection()
      const { minimumOSVersion: _omitted, ...withoutMinimum } = app.app
      expect(
        checkCompatibility(
          { ...app, app: withoutMinimum },
          { ...IPHONE, iosVersion: '12.0' }
        )
      ).toBeUndefined()
    })
  })

  describe('device family', () => {
    it.each<[number[], string | undefined, boolean]>([
      [[1], 'iPhone', true],
      [[2], 'iPhone', false],
      [[1, 2], 'iPhone', true],
      [[1], 'iPod', true],
      [[2], 'iPod', false],
      [[1], 'iPad', true],
      [[2], 'iPad', true],
      [[1, 2], 'iPad', true],
      [[3], 'iPad', false],
      [[2], 'AppleTV', true],
      [[2], undefined, true]
    ])('families %j on a %s runs: %s', (deviceFamilies, deviceClass, runs) => {
      const device: TargetDevice =
        deviceClass === undefined
          ? { iosVersion: '18.0' }
          : { iosVersion: '18.0', deviceClass }
      const problem = checkCompatibility(inspection({ deviceFamilies }), device)
      expect(problem).toEqual(
        runs
          ? undefined
          : {
              code: ErrorCode.UnsupportedDevice,
              data: { deviceFamilies, deviceClass }
            }
      )
    })
  })

  describe('architecture', () => {
    it.each<[string[], boolean]>([
      [['arm64'], true],
      [['arm64e'], true],
      [['armv7', 'arm64'], true],
      [['arm64', 'arm64e'], true],
      [['armv7'], false],
      [['armv7', 'armv7s'], false],
      [['x86_64'], false],
      [[], true]
    ])('slices %j run: %s', (architectures, runs) => {
      const problem = checkCompatibility(inspection({ architectures }), IPHONE)
      expect(problem).toEqual(
        runs
          ? undefined
          : {
              code: ErrorCode.NoArm64Build,
              data: { architectures, supported: ['arm64', 'arm64e'] }
            }
      )
    })
  })

  it('reports the first problem: iOS, then family, then architecture', () => {
    const app = inspection({
      minimumOSVersion: '26.0',
      deviceFamilies: [2],
      architectures: ['armv7']
    })
    expect(checkCompatibility(app, IPHONE)?.code).toBe(ErrorCode.UnsupportedIos)
    expect(
      checkCompatibility(app, { ...IPHONE, iosVersion: '26.0' })?.code
    ).toBe(ErrorCode.UnsupportedDevice)
    expect(
      checkCompatibility(app, { iosVersion: '26.0', deviceClass: 'iPad' })?.code
    ).toBe(ErrorCode.NoArm64Build)
  })
})

describe('assertCompatible', () => {
  it('throws the problem as an IPAForgeError with its data', () => {
    const thrown = (() => {
      try {
        assertCompatible(inspection({ minimumOSVersion: '26.1' }), IPHONE)
      } catch (error) {
        return error
      }
      return undefined
    })()
    expect(thrown).toBeInstanceOf(IPAForgeError)
    expect(thrown).toMatchObject({
      code: ErrorCode.UnsupportedIos,
      data: { minimumOSVersion: '26.1', iosVersion: '18.0' }
    })
  })

  it('returns quietly when the device can run the app', () => {
    expect(() => assertCompatible(inspection(), IPHONE)).not.toThrow()
  })
})

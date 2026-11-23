// What decides whether an app can run on a device: Apple's device-family numbers, lockdown's device classes and
// the CPU architectures current iOS, tvOS and visionOS run.
import { Architecture } from '@signer/domain/macho/constants.ts'

/** `UIDeviceFamily` values. */
export const DeviceFamily = {
  IPhone: 1,
  IPad: 2,
  AppleTV: 3,
  AppleWatch: 4,
  AppleVision: 7
} as const

/** Apple's default when `UIDeviceFamily` is absent: iPhone (and iPod touch) only. */
export const DEFAULT_DEVICE_FAMILIES: readonly number[] = [DeviceFamily.IPhone]

/** lockdownd's `DeviceClass` values for devices that install apps. */
export const DeviceClass = {
  IPhone: 'iPhone',
  IPad: 'iPad',
  IPod: 'iPod',
  AppleTV: 'AppleTV',
  /** Apple Vision Pro. */
  Vision: 'RealityDevice'
} as const

/**
 * The families a device class runs. An iPad also runs iPhone-only apps (in compatibility mode), an Apple TV only tvOS
 * apps, and a Vision Pro its own apps and iPhone and iPad ones. A class missing here is not checked.
 */
export const FAMILIES_BY_DEVICE_CLASS: ReadonlyMap<string, readonly number[]> =
  new Map([
    [DeviceClass.IPhone, [DeviceFamily.IPhone]],
    [DeviceClass.IPod, [DeviceFamily.IPhone]],
    [DeviceClass.IPad, [DeviceFamily.IPhone, DeviceFamily.IPad]],
    [DeviceClass.AppleTV, [DeviceFamily.AppleTV]],
    [
      DeviceClass.Vision,
      [DeviceFamily.IPhone, DeviceFamily.IPad, DeviceFamily.AppleVision]
    ]
  ])

/**
 * The iOS release each visionOS release runs iPhone and iPad apps as, by visionOS major version: such an app's
 * `MinimumOSVersion` is an iOS version. From visionOS 26 the numbers match.
 */
export const IOS_FOR_VISIONOS: ReadonlyMap<number, string> = new Map([
  [1, '17.0'],
  [2, '18.0']
])

/** Devices that run current iOS are 64-bit only: the main executable needs one of these slices. */
export const RUNNABLE_ARCHITECTURES: readonly string[] = [
  Architecture.Arm64,
  Architecture.Arm64e
]

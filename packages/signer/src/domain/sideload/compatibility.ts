// Whether an inspected app can run on a target device: minimum OS version, device family and CPU architecture. Pure,
// so the installer can check before any Apple call and a plan can report the problem without failing.
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import { isVersionAtLeast } from '@signer/domain/macho/version.ts'
import {
  DeviceClass,
  DeviceFamily,
  FAMILIES_BY_DEVICE_CLASS,
  IOS_FOR_VISIONOS,
  RUNNABLE_ARCHITECTURES
} from '@signer/domain/sideload/compatibility-constants.ts'
import type {
  CompatibilityProblem,
  InspectedApp,
  IpaInspection,
  Rule,
  TargetDevice
} from '@signer/domain/sideload/types.ts'

/**
 * The version an app's `MinimumOSVersion` is compared with: the device's own, except for an iPhone or iPad app on a
 * Vision Pro, which is compared with the iOS release visionOS runs it as.
 */
const comparableVersion = (app: InspectedApp, device: TargetDevice): string => {
  if (
    device.deviceClass !== DeviceClass.Vision ||
    app.deviceFamilies.includes(DeviceFamily.AppleVision)
  )
    return device.iosVersion

  return (
    IOS_FOR_VISIONOS.get(Number.parseInt(device.iosVersion, 10)) ??
    device.iosVersion
  )
}

const iosRule: Rule = (app, device) => {
  const minimum = app.minimumOSVersion
  if (
    minimum === undefined ||
    isVersionAtLeast(comparableVersion(app, device), minimum)
  )
    return undefined
  return {
    code: ErrorCode.UnsupportedIos,
    data: { minimumOSVersion: minimum, iosVersion: device.iosVersion }
  }
}

const familyRule: Rule = (app, device) => {
  const { deviceClass } = device
  const runs =
    deviceClass === undefined
      ? undefined
      : FAMILIES_BY_DEVICE_CLASS.get(deviceClass)
  if (deviceClass === undefined || runs === undefined) return undefined
  if (app.deviceFamilies.some((family) => runs.includes(family)))
    return undefined
  return {
    code: ErrorCode.UnsupportedDevice,
    data: { deviceFamilies: app.deviceFamilies, deviceClass }
  }
}

/** No slices means the executable could not be read here; signing reports that. */
const architectureRule: Rule = (app) => {
  const { architectures } = app
  if (
    architectures.length === 0 ||
    architectures.some((arch) => RUNNABLE_ARCHITECTURES.includes(arch))
  ) {
    return undefined
  }
  return {
    code: ErrorCode.NoArm64Build,
    data: { architectures, supported: RUNNABLE_ARCHITECTURES }
  }
}

const RULES: readonly Rule[] = [iosRule, familyRule, architectureRule]

/** The first reason the app cannot run on the device, or `undefined` when it can. */
export const checkCompatibility = (
  inspection: IpaInspection,
  device: TargetDevice
): CompatibilityProblem | undefined => {
  for (const rule of RULES) {
    const problem = rule(inspection.app, device)
    if (problem) return problem
  }
  return undefined
}

/** Throws the problem `checkCompatibility` finds, as a `IPAForgeError` with its code and data. */
export const assertCompatible = (
  inspection: IpaInspection,
  device: TargetDevice
): void => {
  const problem = checkCompatibility(inspection, device)
  if (!problem) return
  throw new IPAForgeError(problem.code, {
    message: 'the app cannot run on this device',
    data: problem.data
  })
}

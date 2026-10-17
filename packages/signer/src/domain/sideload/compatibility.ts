// Whether an inspected app can run on a target device: minimum iOS, device family and CPU architecture. Pure, so
// the installer can check before any Apple call and a plan can report the problem without failing.
import { ErrorCode, LoadstarError } from '@loadstar/kernel'
import { isVersionAtLeast } from '@signer/domain/macho/version.ts'
import {
  FAMILIES_BY_DEVICE_CLASS,
  RUNNABLE_ARCHITECTURES
} from '@signer/domain/sideload/compatibility-constants.ts'
import type {
  CompatibilityProblem,
  IpaInspection,
  Rule,
  TargetDevice
} from '@signer/domain/sideload/types.ts'

const iosRule: Rule = (app, device) => {
  const minimum = app.minimumOSVersion
  if (minimum === undefined || isVersionAtLeast(device.iosVersion, minimum))
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

/** Throws the problem `checkCompatibility` finds, as a `LoadstarError` with its code and data. */
export const assertCompatible = (
  inspection: IpaInspection,
  device: TargetDevice
): void => {
  const problem = checkCompatibility(inspection, device)
  if (!problem) return
  throw new LoadstarError(problem.code, {
    message: 'the app cannot run on this device',
    data: problem.data
  })
}

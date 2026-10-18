import type {
  DeveloperModeState,
  DeviceCheck,
  DeviceSession
} from '@device/application/types.ts'
import {
  DEVELOPER_MODE_MIN_IOS,
  LockdownDomain
} from '@device/domain/constants.ts'
import { parseVersion } from '@device/domain/device.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

/** Classifies the AMFI `DeveloperModeStatus` value for a given iOS version. */
export const developerModeState = (
  productVersion: string,
  status: unknown
): DeveloperModeState => {
  const [major] = parseVersion(productVersion)
  if (major < DEVELOPER_MODE_MIN_IOS) return 'not_required'
  if (status === true) return 'on'
  if (status === false) return 'off'
  return 'unknown'
}

export const checkDevice = async (
  session: DeviceSession
): Promise<DeviceCheck> => {
  const info = await session.info()
  const status = await session
    .getValue('DeveloperModeStatus', LockdownDomain.Amfi)
    .catch(() => undefined)

  return {
    info,
    locked: info.locked === true,
    developerMode: developerModeState(info.productVersion, status),
    activated:
      info.activationState === undefined || info.activationState === 'Activated'
  }
}

/** Throws the catalogued error that blocks running sideloaded apps, if any. */
export const assertCanRunSideloadedApps = (check: DeviceCheck): void => {
  if (check.developerMode === 'off') {
    throw new IPAForgeError(ErrorCode.DeveloperModeOff, {
      data: { iosVersion: check.info.productVersion }
    })
  }
}

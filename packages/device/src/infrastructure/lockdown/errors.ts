import { LOCKDOWN_ERRORS } from '@device/infrastructure/lockdown/constants.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export const lockdownErrorCode = (error: string): ErrorCode =>
  LOCKDOWN_ERRORS[error] ?? ErrorCode.DeviceProtocolError

export const lockdownError = (error: string, request: string): IPAForgeError =>
  new IPAForgeError(lockdownErrorCode(error), {
    message: `lockdownd ${request} failed: ${error}`,
    data: { lockdownError: error, request }
  })

/** True when `error` is lockdownd's `Error` string `name` (e.g. `MissingValue`). */
export const isLockdownError = (error: unknown, name: string): boolean =>
  error instanceof IPAForgeError && error.data?.lockdownError === name

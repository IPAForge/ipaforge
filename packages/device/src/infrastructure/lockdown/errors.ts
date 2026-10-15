import { ErrorCode, LoadstarError } from '@loadstar/kernel'

/** lockdownd `Error` strings the device layer reacts to directly. */
export const LockdownErrorName = {
  /** The key has no value (or, for `EnableWifiDebugging`, no passcode is set). */
  MissingValue: 'MissingValue'
} as const

/** lockdownd `Error` strings → catalogued error codes. Unknown strings stay visible in `data.lockdownError`. */
const LOCKDOWN_ERRORS: Readonly<Record<string, ErrorCode>> = {
  PasswordProtected: ErrorCode.DeviceLocked,
  PairingDialogResponsePending: ErrorCode.PairingPending,
  UserDeniedPairing: ErrorCode.PairingDenied,
  InvalidHostID: ErrorCode.InvalidPairRecord,
  InvalidPairRecord: ErrorCode.InvalidPairRecord,
  InvalidService: ErrorCode.ServiceUnavailable,
  ServiceProhibited: ErrorCode.ServiceUnavailable,
  PairingProhibitedOverThisConnection: ErrorCode.ServiceUnavailable,
  SessionInactive: ErrorCode.DeviceProtocolError
}

export const lockdownErrorCode = (error: string): ErrorCode =>
  LOCKDOWN_ERRORS[error] ?? ErrorCode.DeviceProtocolError

export const lockdownError = (error: string, request: string): LoadstarError =>
  new LoadstarError(lockdownErrorCode(error), {
    message: `lockdownd ${request} failed: ${error}`,
    data: { lockdownError: error, request }
  })

/** True when `error` is lockdownd's `Error` string `name` (e.g. `MissingValue`). */
export const isLockdownError = (error: unknown, name: string): boolean =>
  error instanceof LoadstarError && error.data?.lockdownError === name

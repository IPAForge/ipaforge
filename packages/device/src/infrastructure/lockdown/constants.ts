// lockdownd error strings and the catalogued codes they map to.
import { ErrorCode } from '@loadstar/kernel'

/** lockdownd `Error` strings the device layer reacts to directly. */
export const LockdownErrorName = {
  /** The key has no value (or, for `EnableWifiDebugging`, no passcode is set). */
  MissingValue: 'MissingValue'
} as const

/** lockdownd `Error` strings → catalogued error codes. Unknown strings stay visible in `data.lockdownError`. */
export const LOCKDOWN_ERRORS: Readonly<Record<string, ErrorCode>> = {
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

import { ErrorCode, LoadstarError } from "@loadstar/kernel";

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
  SessionInactive: ErrorCode.DeviceProtocolError,
};

export const lockdownErrorCode = (error: string): ErrorCode => LOCKDOWN_ERRORS[error] ?? ErrorCode.DeviceProtocolError;

export const lockdownError = (error: string, request: string): LoadstarError =>
  new LoadstarError(lockdownErrorCode(error), {
    message: `lockdownd ${request} failed: ${error}`,
    data: { lockdownError: error, request },
  });

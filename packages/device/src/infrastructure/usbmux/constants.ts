// usbmuxd results and how the client reads them.
import { UsbmuxResult } from '@device/domain/constants.ts'
import { ErrorCode } from '@ipaforge/kernel'

/** usbmuxd `Result` numbers with a dedicated error code; anything else is a protocol error. */
export const RESULT_ERRORS: ReadonlyMap<number, ErrorCode> = new Map([
  [UsbmuxResult.BadDevice, ErrorCode.DeviceNotFound],
  [UsbmuxResult.ConnectionRefused, ErrorCode.ServiceUnavailable]
])

/** Stands in for a response that is not a `Result` message, so it reads as a failure. */
export const RESULT_UNKNOWN = -1

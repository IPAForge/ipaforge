import { ErrorCode } from '@loadstar/kernel'

/** Errors worth retrying for an idempotent step: the network, rate limits, busy services, dropped devices.
 * (Catalog download errors join this list when the install flows use the catalog.) */
export const TRANSIENT: ReadonlySet<string> = new Set([
  ErrorCode.Offline,
  ErrorCode.RateLimited,
  ErrorCode.AppleServiceUnavailable,
  ErrorCode.DeviceDisconnected,
  ErrorCode.DeviceTimeout,
  ErrorCode.AnisetteUnavailable
])

/** Attempts for an idempotent step when the caller doesn't say. */
export const DEFAULT_ATTEMPTS = 3

// How the runner reads a step's failure: retry it, treat it as a cancellation, or report it.
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

/** Errors worth retrying for an idempotent step: the network, rate limits, busy services, dropped devices.
 * (Catalog download errors join this list when the install flows use the catalog.) */
const TRANSIENT: ReadonlySet<string> = new Set([
  ErrorCode.Offline,
  ErrorCode.RateLimited,
  ErrorCode.AppleServiceUnavailable,
  ErrorCode.DeviceDisconnected,
  ErrorCode.DeviceTimeout,
  ErrorCode.AnisetteUnavailable,
]);

export const isTransient = (error: unknown): boolean => error instanceof LoadstarError && TRANSIENT.has(error.code);

export const isAbort = (error: unknown, signal: AbortSignal): boolean =>
  signal.aborted || (error instanceof LoadstarError && error.code === ErrorCode.Aborted);

/** Keeps a `LoadstarError` as is; wraps anything else as `installer.step_failed` for `stepId`. */
export const asLoadstarError = (error: unknown, stepId: string): LoadstarError =>
  error instanceof LoadstarError
    ? error
    : new LoadstarError(ErrorCode.StepFailed, { cause: error, data: { step: stepId } });

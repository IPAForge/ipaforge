// What a caller can ask of pairing, and the progress it reports.
import type { DeviceContext } from '@device/application/context.ts'
import type { PairRecordStore } from '@device/application/pair-records.ts'
import { shortUdid } from '@device/domain/device.ts'

export type PairingProgress =
  | { readonly stage: 'waiting_for_trust' }
  | { readonly stage: 'waiting_for_unlock' }
  | { readonly stage: 'paired'; readonly savedTo: PairRecordStore }

/**
 * `os`: wait for the pair record the OS creates when the user taps Trust, and pair on our own only if none
 * appears within `osPairingTimeoutMs`. `own`: pair on our own straight away.
 */
export type PairMethod = 'os' | 'own'

export type PairOptions = {
  /** Default `"os"`. */
  readonly method?: PairMethod
  readonly onProgress?: (event: PairingProgress) => void
  readonly signal?: AbortSignal
}

/** Logs and reports a finished pairing. */
export const reportPaired = (
  ctx: DeviceContext,
  udid: string,
  savedTo: PairRecordStore,
  options: PairOptions
): void => {
  ctx.deps.logger.info('paired', { device: shortUdid(udid), savedTo })
  options.onProgress?.({ stage: 'paired', savedTo })
}

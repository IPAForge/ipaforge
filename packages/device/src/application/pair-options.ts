// Reports a finished pairing (the options and progress types are in types.ts).
import type { DeviceContext } from '@device/application/context.ts'
import type { PairOptions, PairRecordStore } from '@device/application/types.ts'
import { shortUdid } from '@device/domain/device.ts'

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

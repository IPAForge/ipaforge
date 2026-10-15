// Pairing: the OS's pair record by default (the user taps Trust), Loadstar's own pairing as the fallback.
import type { DeviceContext } from '@device/application/context.ts'
import {
  type PairOptions,
  reportPaired
} from '@device/application/pair-options.ts'
import { waitForOsPairRecord } from '@device/application/pair-os.ts'
import { pairWithOwnRecord } from '@device/application/pair-own.ts'
import type { StoredPairRecord } from '@device/application/pair-records.ts'
import { shortUdid, type UsbmuxDevice } from '@device/domain/device.ts'

const pairOwn = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  options: PairOptions
): Promise<StoredPairRecord> => ({
  record: await pairWithOwnRecord(ctx, device, options),
  source: 'secret_store'
})

/**
 * Pairs with `device`. By default waits for the OS to create its pair record when the user taps Trust, and pairs
 * on our own only when none appears within `osPairingTimeoutMs`; `method: "own"` pairs on our own straight away.
 */
export const pairDevice = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  options: PairOptions = {}
): Promise<StoredPairRecord> => {
  if (options.method === 'own') return pairOwn(ctx, device, options)
  const record = await waitForOsPairRecord(ctx, device.udid, options)
  if (record) {
    reportPaired(ctx, device.udid, 'usbmuxd', options)
    return { record, source: 'usbmuxd' }
  }
  ctx.deps.logger.warn('the OS did not pair in time; pairing on our own', {
    device: shortUdid(device.udid)
  })
  return pairOwn(ctx, device, options)
}

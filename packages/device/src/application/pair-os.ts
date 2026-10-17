// Waiting for the OS to pair: when the user taps Trust, the OS's usbmuxd creates the pair record itself.
import type { DeviceContext } from '@device/application/context.ts'
import { readOsPairRecord } from '@device/application/pair-records.ts'
import type { PairOptions } from '@device/application/types.ts'
import type { PairRecord } from '@device/domain/pairing/types.ts'

/**
 * Polls usbmuxd every `pairingPollIntervalMs` until the OS has a pair record for `udid`, reporting
 * `waiting_for_trust` meanwhile. Returns `undefined` when none appears within `osPairingTimeoutMs`.
 */
export const waitForOsPairRecord = async (
  ctx: DeviceContext,
  udid: string,
  options: PairOptions
): Promise<PairRecord | undefined> => {
  const { clock, sleep, config } = ctx.deps
  const deadline = clock.now().getTime() + config.osPairingTimeoutMs
  for (;;) {
    options.signal?.throwIfAborted()
    const record = await readOsPairRecord(ctx, udid)
    if (record) return record
    if (clock.now().getTime() >= deadline) return undefined
    options.onProgress?.({ stage: 'waiting_for_trust' })
    await sleep(config.pairingPollIntervalMs, options.signal)
  }
}

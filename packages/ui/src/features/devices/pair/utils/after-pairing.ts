import { ErrorCode } from '@ipaforge/kernel'
import type { PairStep } from '@ui/features/devices/pair/types.ts'
import type {
  PairableDevice,
  PairByCodeRun
} from '@ui/services/engine/types.ts'

const SECOND_MS = 1000

/** The step a finished pairing run leads to: paired, the device's wait, its screen closed, or the failure. */
export const afterPairing = (
  target: PairableDevice,
  result: Awaited<PairByCodeRun['result']>,
  now: number
): PairStep => {
  if (result.status === 'cancelled') return { phase: 'find' }
  if (result.status === 'completed')
    return result.state.paired
      ? { phase: 'done', paired: result.state.paired }
      : { phase: 'find' }
  const { error } = result
  if (error.code === ErrorCode.PairingScreenClosed)
    return { phase: 'closed', target }
  if (error.code === ErrorCode.PairingBackoff) {
    const seconds = (error.data as { seconds?: unknown }).seconds

    return {
      phase: 'backoff',
      target,
      until: typeof seconds === 'number' ? now + seconds * SECOND_MS : undefined
    }
  }
  return { phase: 'failed', target, error }
}

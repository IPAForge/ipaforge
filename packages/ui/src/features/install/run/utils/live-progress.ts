import { installdPhases } from '@ui/features/install/run/constants.ts'
import type { LiveProgress } from '@ui/features/install/run/types.ts'
import type { StepDetail } from '@ui/state/active-run/types.ts'

const PERCENT = 100
const MS_PER_SECOND = 1000

/** Bytes moved: the percent, the speed so far, and the time left at that speed. */
const bytesProgress = (
  received: number,
  total: number,
  elapsedMs: number | undefined
): LiveProgress => {
  const bytesPerSecond =
    elapsedMs && received > 0
      ? received / (elapsedMs / MS_PER_SECOND)
      : undefined

  return {
    percent: Math.min(PERCENT, Math.floor((received / total) * PERCENT)),
    bytes: { received, total },
    ...(bytesPerSecond
      ? { bytesPerSecond, secondsLeft: (total - received) / bytesPerSecond }
      : {})
  }
}

/** iOS installing: its percent and phase, and the time left if it keeps going as it has. */
const installingProgress = (
  percent: number,
  status: string | undefined,
  elapsedMs: number | undefined
): LiveProgress => ({
  percent,
  phase: (status && installdPhases[status]) || 'installing',
  ...(elapsedMs && percent > 0
    ? {
        secondsLeft:
          ((elapsedMs / MS_PER_SECOND) * (PERCENT - percent)) / percent
      }
    : {})
})

/**
 * A running step's progress in numbers, from what the Engine sent: requests to Apple while provisioning, bytes with
 * a total (a download, the app sent to the device), or iOS installing it. Undefined for anything else, which the step shows as before.
 */
/** Requests to Apple: how far overall, which task and how many of its requests, and the time left at this pace. */
const provisioningProgress = (
  detail: Extract<StepDetail, { kind: 'provisioning' }>
): LiveProgress => ({
  percent: Math.floor(detail.fraction * PERCENT),
  task: { name: detail.task, done: detail.done, total: detail.total },
  ...(detail.elapsedMs && detail.fraction > 0
    ? {
        secondsLeft:
          ((detail.elapsedMs / MS_PER_SECOND) * (1 - detail.fraction)) /
          detail.fraction
      }
    : {})
})

export const liveProgress = (
  detail: StepDetail | undefined
): LiveProgress | undefined => {
  if (detail?.kind === 'provisioning') return provisioningProgress(detail)
  if (detail?.kind === 'installing')
    return installingProgress(detail.percent, detail.status, detail.elapsedMs)
  if (detail?.kind === 'bytes' && detail.total)
    return bytesProgress(detail.received, detail.total, detail.elapsedMs)

  return undefined
}

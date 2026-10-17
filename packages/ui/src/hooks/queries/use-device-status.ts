import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { ErrorCode, toLoadstarError } from '@loadstar/kernel'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** Answers that a second read won't change: the device doesn't trust this computer, or the user must act. */
const SETTLED: ReadonlySet<string> = new Set([
  ErrorCode.DeviceNotPaired,
  ErrorCode.PairingPending,
  ErrorCode.PairingDenied,
  ErrorCode.InvalidPairRecord,
  ErrorCode.DeviceLocked
])

/** A Wi-Fi device can drop off for a moment (its screen locking, the network); read once more after a pause. */
const RETRY_DELAY_MS = 1500

const retryOnce = (failures: number, error: unknown): boolean =>
  failures < 1 && !SETTLED.has(toLoadstarError(error).code)

/**
 * Name, model, iOS, lock state and Developer Mode of a device; fails with `device.not_paired` and the like. Never
 * read on a timer: the device feed reads it again when the device comes or goes, and `useRefreshDeviceStatus`
 * when the user looks (the device menu, the Devices page, Check again). A device that is not connected is not
 * asked; its last answer stays in the cache for the session, so a picked device that was unplugged keeps its name.
 */
export const useDeviceStatus = (
  udid: string | undefined,
  isConnected = true
) => {
  const engine = useEngine()

  return useQuery({
    queryKey: queryKeys.deviceStatus(udid),
    queryFn: udid && isConnected ? () => engine.deviceStatus(udid) : skipToken,
    gcTime: Number.POSITIVE_INFINITY,
    retry: retryOnce,
    retryDelay: RETRY_DELAY_MS
  })
}

/** Reads the status of every connected device again (disconnected ones are skipped by their queries). */
export const useRefreshDeviceStatus = (): (() => void) => {
  const queryClient = useQueryClient()

  return useCallback(() => {
    void queryClient.invalidateQueries({
      predicate: ({ queryKey }) =>
        queryKey[0] === 'devices' && queryKey[2] === 'status'
    })
  }, [queryClient])
}

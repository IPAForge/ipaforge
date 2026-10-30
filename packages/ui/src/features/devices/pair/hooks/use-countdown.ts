import { useEffect, useState } from 'react'

import { COUNTDOWN_TICK_MS } from '@ui/features/devices/pair/constants.ts'

const SECOND_MS = 1000

/** Whole seconds left until `until` (a time in ms), counting down each second; 0 once it has passed. */
export const useCountdown = (until: number | undefined): number => {
  const left = () =>
    until === undefined
      ? 0
      : Math.max(0, Math.ceil((until - Date.now()) / SECOND_MS))
  const [seconds, setSeconds] = useState(left)
  useEffect(() => {
    if (until === undefined) return
    const timer = setInterval(
      () =>
        setSeconds(Math.max(0, Math.ceil((until - Date.now()) / SECOND_MS))),
      COUNTDOWN_TICK_MS
    )

    return () => clearInterval(timer)
  }, [until])

  return seconds
}

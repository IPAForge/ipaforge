import { useEffect, useState } from 'react'

import { REVEAL_STEP_MS } from '@ui/features/repair/constants.ts'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia(REDUCED_MOTION).matches

/**
 * How many of `total` results to show: one more every step after `since` (when they arrived), so the checks come
 * in one by one; all at once when the system asks for reduced motion. Nothing while `since` is undefined.
 */
export const useReveal = (total: number, since: number | undefined): number => {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (since === undefined) {
      setShown(0)
      return
    }
    if (prefersReducedMotion()) {
      setShown(total)
      return
    }
    setShown(0)
    const timer = setInterval(() => {
      setShown((current) => {
        if (current + 1 >= total) clearInterval(timer)

        return Math.min(total, current + 1)
      })
    }, REVEAL_STEP_MS)

    return () => clearInterval(timer)
  }, [total, since])

  return shown
}

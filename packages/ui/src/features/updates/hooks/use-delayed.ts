import { useEffect, useState } from 'react'

/** Turns true after `ms`, to show something only if it lasts. */
export const useDelayed = (ms: number): boolean => {
  const [isDue, setIsDue] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsDue(true), ms)

    return () => clearTimeout(timer)
  }, [ms])

  return isDue
}

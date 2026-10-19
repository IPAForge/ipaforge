import { useRef } from 'react'

import type { RunView } from '@ui/state/active-run/types.ts'

const MS_PER_SECOND = 1000
/** Below this share done, a guess from so little would jump around: none is shown. */
const MIN_FRACTION = 0.05

/** The run's time left, from how long it has taken so far for how far it got; undefined when it isn't running. */
export const useRunTimeLeft = (view: RunView): number | undefined => {
  const started = useRef<number | undefined>(undefined)
  const isRunning = view.status === 'running'

  if (!isRunning) return undefined

  started.current ??= Date.now()

  if (view.fraction < MIN_FRACTION) return undefined

  const elapsed = (Date.now() - started.current) / MS_PER_SECOND

  return (elapsed * (1 - view.fraction)) / view.fraction
}

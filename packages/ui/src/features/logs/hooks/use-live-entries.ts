import { useEffect, useState } from 'react'

import { LOG_BUFFER_CAPACITY, type LogEntry } from '@loadstar/kernel'
import { useEngine } from '@ui/hooks/use-engine.ts'

/**
 * Every entry the Engine logs while Logs is open, pushed as it happens (never polled), unfiltered. Keeps at most
 * as many as the Engine's buffer does.
 */
export const useLiveEntries = (): readonly LogEntry[] => {
  const engine = useEngine()
  const [entries, setEntries] = useState<readonly LogEntry[]>([])

  useEffect(
    () =>
      engine.logs.watch((entry) =>
        setEntries((current) => [...current, entry].slice(-LOG_BUFFER_CAPACITY))
      ),
    [engine]
  )

  return entries
}

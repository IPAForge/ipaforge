import { useState } from 'react'

import type {
  ServerTestState,
  ServerTests
} from '@ui/features/settings/anisette/types.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import type { AnisetteServerTest } from '@ui/services/engine/types.ts'

const toState = (result: AnisetteServerTest): ServerTestState =>
  result.ok && result.latencyMs !== undefined
    ? { phase: 'ok', latencyMs: result.latencyMs }
    : { phase: 'bad' }

/**
 * Each server's test while Settings is open: Testing…, then how fast it answered or that it didn't. Test all runs
 * them side by side; nothing is kept once the page closes.
 */
export const useServerTests = (): ServerTests => {
  const engine = useEngine()
  const [states, setStates] = useState<Record<string, ServerTestState>>({})
  const record = (address: string, state: ServerTestState) =>
    setStates((current) => ({ ...current, [address]: state }))
  const test = (address: string) => {
    record(address, { phase: 'testing' })
    engine.testAnisetteServer(address).then(
      (result) => record(address, toState(result)),
      () => record(address, { phase: 'bad' })
    )
  }

  return {
    states,
    test,
    testAll: (addresses) => {
      for (const address of addresses) test(address)
    },
    record
  }
}

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { toIPAForgeError } from '@ipaforge/kernel'
import { PromptKind } from '@ipaforge/rpc'
import { PAIRING_CODE_LENGTH } from '@ui/features/devices/pair/constants.ts'
import type {
  PairStep,
  UsePairByCode
} from '@ui/features/devices/pair/types.ts'
import { afterPairing } from '@ui/features/devices/pair/utils/after-pairing.ts'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import type {
  PairableDevice,
  PairByCodeRun
} from '@ui/services/engine/types.ts'

/**
 * Pairs an Apple TV or Vision Pro through the Engine's `pairByCode` run: the code it shows answers the run's
 * question, asked again after a wrong one. Once paired, the list of paired devices is read again. Unmounting (the
 * dialog closing) or going back to the list ends a pairing under way.
 */
export const usePairByCode = (): UsePairByCode => {
  const engine = useEngine()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<PairStep>({ phase: 'find' })
  const run = useRef<PairByCodeRun | undefined>(undefined)

  useEffect(() => () => run.current?.cancel(), [])

  const stop = () => {
    const handle = run.current
    run.current = undefined
    handle?.cancel()
  }

  const follow = (handle: PairByCodeRun, target: PairableDevice) => {
    let count = 0
    handle.subscribe((event) => {
      if (run.current !== handle || event.type !== 'prompt') return
      if (event.request.kind !== PromptKind.PairingCode) return
      count += 1
      const { retry, codeLength } = event.request.data ?? {}
      setStep({
        phase: 'code',
        target,
        retry: retry === true,
        codeLength:
          typeof codeLength === 'number' ? codeLength : PAIRING_CODE_LENGTH,
        count,
        isPending: false
      })
    })
    handle.result.then(
      (result) => {
        if (run.current !== handle) return
        run.current = undefined
        setStep(afterPairing(target, result, Date.now()))
        if (result.status === 'completed')
          void queryClient.invalidateQueries({ queryKey: queryKeys.codePaired })
      },
      (error: unknown) => {
        if (run.current !== handle) return
        run.current = undefined
        setStep({ phase: 'failed', target, error: toIPAForgeError(error) })
      }
    )
  }

  return {
    step,
    start: (target) => {
      stop()
      const handle = engine.pairByCode({ target })
      run.current = handle
      setStep({
        phase: 'code',
        target,
        retry: false,
        codeLength: PAIRING_CODE_LENGTH,
        count: 0,
        isPending: true
      })
      follow(handle, target)
    },
    answer: (code) => {
      const handle = run.current
      if (!handle?.pending()) return
      handle.answer(code)
      setStep((current) =>
        current.phase === 'code' ? { ...current, isPending: true } : current
      )
    },
    back: () => {
      stop()
      setStep({ phase: 'find' })
    }
  }
}

import { useEffect, useState } from 'react'

import type { PairableSearch } from '@ui/features/devices/pair/types.ts'
import { nextSearch } from '@ui/features/devices/pair/utils/next-search.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** Apple TVs and Vision Pros showing their pairing screen, searched for while the component is mounted. */
export const usePairableDevices = (): PairableSearch => {
  const engine = useEngine()
  const [search, setSearch] = useState<PairableSearch>({
    devices: [],
    isDenied: false,
    hasFailed: false
  })
  useEffect(
    () =>
      engine.watchPairableDevices((event) =>
        setSearch((current) => nextSearch(current, event))
      ),
    [engine]
  )

  return search
}

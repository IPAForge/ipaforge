import { useState } from 'react'

import type { PairingAppChoice } from '@loadstar/rpc'
import type { PairingChoice } from '@ui/features/install/prompts/types.ts'

/** The apps ticked for the pairing file: all of them to start with, since the Engine offers only apps that use it. */
export const usePairingChoice = (
  apps: readonly PairingAppChoice[]
): PairingChoice => {
  const all = apps.map((app) => app.bundleId)
  const [chosen, setChosen] = useState<string[]>(all)
  const isAllChosen = chosen.length === apps.length

  return {
    chosen,
    isAllChosen,
    setChosen,
    toggleAll: () => setChosen(isAllChosen ? [] : all)
  }
}

import { createContext } from 'react'

import type { SelectionStore } from '@ui/state/selection/selection-store.ts'

export const SelectionContext = createContext<SelectionStore | undefined>(
  undefined
)

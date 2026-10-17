import { createContext } from 'react'

import type { SelectionStore } from '@ui/state/selection/types.ts'

export const SelectionContext = createContext<SelectionStore | undefined>(
  undefined
)

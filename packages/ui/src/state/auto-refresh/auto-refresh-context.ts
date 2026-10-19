import { createContext } from 'react'

import type { AutoRefreshStore } from '@ui/state/auto-refresh/types.ts'

export const AutoRefreshContext = createContext<AutoRefreshStore | undefined>(
  undefined
)

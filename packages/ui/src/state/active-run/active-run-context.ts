import { createContext } from 'react'

import type { ActiveRunStore } from '@ui/state/active-run/types.ts'

export const ActiveRunContext = createContext<ActiveRunStore | undefined>(
  undefined
)

import { createContext } from 'react'

import type { ActiveRunStore } from '@ui/state/active-run/active-run-store.ts'

export const ActiveRunContext = createContext<ActiveRunStore | undefined>(
  undefined
)

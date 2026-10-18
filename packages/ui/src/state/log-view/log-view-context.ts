import { createContext } from 'react'

import type { LogViewStore } from '@ui/state/log-view/types.ts'

export const LogViewContext = createContext<LogViewStore | undefined>(undefined)

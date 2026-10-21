import { createContext } from 'react'

import type { GuideStore } from '@ui/state/guide/types.ts'

export const GuideContext = createContext<GuideStore | undefined>(undefined)

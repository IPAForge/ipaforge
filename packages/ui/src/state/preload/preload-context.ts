import { createContext } from 'react'

import type { PreloadStore } from '@ui/state/preload/types.ts'

export const PreloadContext = createContext<PreloadStore | undefined>(undefined)

import { createContext } from 'react'

import type { ThemeStore } from '@ui/theme/store/types.ts'

/** The app's theme store, provided by `ThemeProvider` and read through `useTheme`. */
export const ThemeContext = createContext<ThemeStore | undefined>(undefined)

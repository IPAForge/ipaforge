import { useContext, useSyncExternalStore } from 'react'

import { ThemeContext } from '@ui/theme/provider/theme-context.ts'
import type { ThemeState, ThemeStore } from '@ui/theme/store/types.ts'

const useThemeStore = (): ThemeStore => {
  const store = useContext(ThemeContext)
  if (!store) throw new Error('useTheme must be used inside <ThemeProvider>')
  return store
}

/** The current palette, mode and resolved scheme, plus the setters that persist them. */
export const useTheme = (): ThemeState &
  Pick<ThemeStore, 'setPalette' | 'setMode'> => {
  const store = useThemeStore()
  const state = useSyncExternalStore(store.subscribe, store.getState)

  return { ...state, setPalette: store.setPalette, setMode: store.setMode }
}

import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore
} from 'react'

import { useUiServices } from '@ui/hooks/use-ui-services.ts'
import { applyPalette } from '@ui/theme/palettes/apply-palette.ts'
import { palettes } from '@ui/theme/palettes/palettes.ts'
import { ThemeContext } from '@ui/theme/provider/theme-context.ts'
import { createThemeStore } from '@ui/theme/store/theme-store.ts'

/** Owns the theme store for the app's lifetime and keeps `<html>` in sync with it. */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { preferences, colorScheme, logger } = useUiServices()
  const [store] = useState(() =>
    createThemeStore({ preferences, system: colorScheme, logger })
  )
  const { palette, scheme } = useSyncExternalStore(
    store.subscribe,
    store.getState
  )

  useEffect(() => store.followSystem(), [store])
  useLayoutEffect(
    () =>
      applyPalette(document.documentElement, palettes[palette][scheme], scheme),
    [palette, scheme]
  )

  return <ThemeContext value={store}>{children}</ThemeContext>
}

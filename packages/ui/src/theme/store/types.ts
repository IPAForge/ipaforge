import type { Logger } from '@loadstar/kernel'
import type { PreferencesStore } from '@ui/services/preferences/preferences-store.ts'
import type {
  ColorScheme,
  ColorSchemeSource
} from '@ui/services/system/types.ts'
import type { ColorMode, PaletteId } from '@ui/theme/types.ts'

export type ThemeState = {
  readonly palette: PaletteId
  readonly mode: ColorMode
  /** The scheme actually shown: `mode`, or the OS preference when `mode` is `system`. */
  readonly scheme: ColorScheme
}

export type ThemeStore = {
  getState: () => ThemeState
  subscribe: (listener: () => void) => () => void
  setPalette: (palette: PaletteId) => void
  setMode: (mode: ColorMode) => void
  /** Starts following OS preference changes (for the `system` mode); returns the function that stops it. */
  followSystem: () => () => void
}

export type ThemeStoreOptions = {
  readonly preferences: PreferencesStore
  readonly system: ColorSchemeSource
  readonly logger: Logger
}

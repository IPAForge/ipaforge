import type { PreferencesStore } from '@ui/services/preferences/preferences-store.ts'
import type {
  ColorScheme,
  ColorSchemeSource
} from '@ui/services/system/types.ts'
import { colorModes, paletteIds } from '@ui/theme/constants.ts'
import {
  defaultColorMode,
  defaultPalette,
  ThemePreferenceKey
} from '@ui/theme/store/theme-config.ts'
import type {
  ThemeState,
  ThemeStore,
  ThemeStoreOptions
} from '@ui/theme/store/types.ts'
import type { ColorMode, PaletteId } from '@ui/theme/types.ts'

const isOneOf = <T extends string>(
  values: readonly T[],
  value: string | undefined
): value is T =>
  value !== undefined && (values as readonly string[]).includes(value)

const readPalette = (preferences: PreferencesStore): PaletteId => {
  const saved = preferences.read(ThemePreferenceKey.Palette)

  return isOneOf(paletteIds, saved) ? saved : defaultPalette
}

const readMode = (preferences: PreferencesStore): ColorMode => {
  const saved = preferences.read(ThemePreferenceKey.Mode)

  return isOneOf(colorModes, saved) ? saved : defaultColorMode
}

const resolveScheme = (
  mode: ColorMode,
  system: ColorSchemeSource
): ColorScheme => (mode === 'system' ? system.current() : mode)

/** Palette and colour mode, persisted through `PreferencesStore` and following the OS when the mode is `system`. */
export const createThemeStore = ({
  preferences,
  system,
  logger
}: ThemeStoreOptions): ThemeStore => {
  const log = logger.child({ scope: 'theme' })
  const listeners = new Set<() => void>()
  const mode = readMode(preferences)
  let state: ThemeState = {
    palette: readPalette(preferences),
    mode,
    scheme: resolveScheme(mode, system)
  }

  const update = (next: ThemeState): void => {
    state = next
    for (const listener of listeners) listener()
  }

  const onSystemChange = (scheme: ColorScheme): void => {
    if (state.mode !== 'system' || state.scheme === scheme) return
    log.debug('system colour scheme changed', { scheme })
    update({ ...state, scheme })
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setPalette: (palette) => {
      if (palette === state.palette) return
      preferences.write(ThemePreferenceKey.Palette, palette)
      log.debug('palette changed', { palette })
      update({ ...state, palette })
    },
    setMode: (next) => {
      if (next === state.mode) return
      preferences.write(ThemePreferenceKey.Mode, next)
      const scheme = resolveScheme(next, system)
      log.debug('colour mode changed', { mode: next, scheme })
      update({ ...state, mode: next, scheme })
    },
    followSystem: () => {
      onSystemChange(system.current()) // the OS may have switched before we started listening
      return system.subscribe(onSystemChange)
    }
  }
}

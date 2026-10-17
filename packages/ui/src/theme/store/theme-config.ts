import type { ColorMode, PaletteId } from '@ui/theme/types.ts'

export const defaultPalette: PaletteId = 'graphite'
export const defaultColorMode: ColorMode = 'system'

/** `PreferencesStore` keys the theme persists under. */
export const ThemePreferenceKey = {
  Palette: 'theme.palette',
  Mode: 'theme.mode'
} as const

import type { ColorScheme } from '@ui/services/system/color-scheme-source.ts'
import type { PaletteTokens } from '@ui/theme/theme-types.ts'

/** The HeroUI v3 theme variable each palette token sets (see `@heroui/styles` themes/default/variables.css). */
export const heroUiVariables = {
  accent: '--accent',
  accentForeground: '--accent-foreground',
  background: '--background',
  foreground: '--foreground',
  surface: '--surface',
  surfaceSecondary: '--surface-secondary',
  surfaceTertiary: '--surface-tertiary',
  overlay: '--overlay',
  muted: '--muted',
  default: '--default',
  defaultForeground: '--default-foreground',
  border: '--border',
  separator: '--separator'
} as const satisfies Readonly<Record<keyof PaletteTokens, `--${string}`>>

/** HeroUI switches its dark defaults (shadows, `color-scheme`) on this class and `data-theme`. */
const THEME_ATTRIBUTE = 'data-theme'

const setScheme = (root: HTMLElement, scheme: ColorScheme): void => {
  const other: ColorScheme = scheme === 'dark' ? 'light' : 'dark'
  root.classList.remove(other)
  root.classList.add(scheme)
  root.setAttribute(THEME_ATTRIBUTE, scheme)
}

/** Writes the palette's tokens as HeroUI CSS variables on `root` (normally `<html>`) and marks the scheme. */
export const applyPalette = (
  root: HTMLElement,
  tokens: PaletteTokens,
  scheme: ColorScheme
): void => {
  for (const [token, variable] of Object.entries(heroUiVariables)) {
    root.style.setProperty(variable, tokens[token as keyof PaletteTokens])
  }
  setScheme(root, scheme)
}

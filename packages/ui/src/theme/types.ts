import type { ColorScheme } from '@ui/services/system/types.ts'
import type { colorModes, paletteIds } from '@ui/theme/constants.ts'

export type PaletteId = (typeof paletteIds)[number]

/** What the user picked; `system` follows the OS and resolves to a `ColorScheme`. */
export type ColorMode = (typeof colorModes)[number]

/**
 * The base colours of a palette, as oklch strings. HeroUI derives the rest (hover, soft and
 * secondary border shades) from these with `color-mix()`.
 */
export type PaletteTokens = {
  readonly accent: string
  readonly accentForeground: string
  readonly background: string
  readonly foreground: string
  readonly surface: string
  readonly surfaceSecondary: string
  readonly surfaceTertiary: string
  readonly overlay: string
  readonly muted: string
  readonly default: string
  readonly defaultForeground: string
  readonly border: string
  readonly separator: string
}

export type Palette = Readonly<Record<ColorScheme, PaletteTokens>>

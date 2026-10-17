import type { PaletteTokens } from '@ui/theme/types.ts'

/** The tokens each swatch previews, in display order. */
export const PREVIEW_TOKENS = [
  'accent',
  'background',
  'surfaceTertiary'
] as const satisfies readonly (keyof PaletteTokens)[]

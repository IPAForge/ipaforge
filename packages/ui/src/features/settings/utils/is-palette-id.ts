import { paletteIds } from '@ui/theme/constants.ts'
import type { PaletteId } from '@ui/theme/types.ts'

export const isPaletteId = (value: string): value is PaletteId =>
  paletteIds.some((id) => id === value)

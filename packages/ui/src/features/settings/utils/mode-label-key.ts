import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { ColorMode } from '@ui/theme/types.ts'

export const modeLabelKey = (mode: ColorMode): TranslationKey =>
  `theme.mode.${mode}`

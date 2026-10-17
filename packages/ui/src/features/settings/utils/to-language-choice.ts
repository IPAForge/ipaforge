import type { Key } from 'react'

import { SYSTEM_LANGUAGE } from '@ui/i18n/languages/language-store.ts'
import { isAvailableLanguage } from '@ui/i18n/languages/languages.ts'
import type { LanguageChoice } from '@ui/i18n/languages/types.ts'

/** The language picked in the select: the system, or one the picker offers; undefined for anything else. */
export const toLanguageChoice = (
  key: Key | null
): LanguageChoice | undefined => {
  const value = String(key)
  if (value === SYSTEM_LANGUAGE) return SYSTEM_LANGUAGE
  return isAvailableLanguage(value) ? value : undefined
}

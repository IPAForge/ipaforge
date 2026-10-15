import { createContext } from 'react'

import type { LanguageSetup } from '@ui/i18n/setup/prepare-language.ts'

/** The app's language setup, provided by `LanguageProvider` and read through `useLanguage`. */
export const LanguageContext = createContext<LanguageSetup | undefined>(
  undefined
)

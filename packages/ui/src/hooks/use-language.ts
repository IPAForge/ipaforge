import { useContext, useSyncExternalStore } from 'react'

import type { LanguageState } from '@ui/i18n/languages/types.ts'
import { LanguageContext } from '@ui/i18n/provider/language-context.ts'
import type { LanguageSetup } from '@ui/i18n/setup/types.ts'

const useLanguageSetup = (): LanguageSetup => {
  const setup = useContext(LanguageContext)
  if (!setup)
    throw new Error('useLanguage must be used inside <LanguageProvider>')
  return setup
}

/** The language choice, the detected system language and the language shown, plus `choose`, which loads and saves. */
export const useLanguage = (): LanguageState &
  Pick<LanguageSetup, 'choose'> => {
  const { store, choose } = useLanguageSetup()
  const state = useSyncExternalStore(store.subscribe, store.getState)

  return { ...state, choose }
}

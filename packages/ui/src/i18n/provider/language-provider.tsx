import { type ReactNode, useLayoutEffect, useSyncExternalStore } from 'react'
import { I18nProvider } from 'react-aria-components'
import { I18nextProvider } from 'react-i18next'

import { applyLocale } from '@ui/i18n/languages/apply-locale.ts'
import { LanguageContext } from '@ui/i18n/provider/language-context.ts'
import type { LanguageSetup } from '@ui/i18n/setup/types.ts'

type LanguageProviderProps = {
  /** From `prepareLanguage`: the active language's messages are already loaded. */
  setup: LanguageSetup
  children: ReactNode
}

/**
 * Provides the language setup and its i18next instance, keeps `<html lang dir>` in sync, and gives React Aria
 * (dates, numbers, keyboard direction in HeroUI components) the same locale.
 */
export const LanguageProvider = ({
  setup,
  children
}: LanguageProviderProps) => {
  const { locale } = useSyncExternalStore(
    setup.store.subscribe,
    setup.store.getState
  )

  useLayoutEffect(() => applyLocale(document.documentElement, locale), [locale])

  return (
    <LanguageContext value={setup}>
      <I18nextProvider i18n={setup.i18n}>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </I18nextProvider>
    </LanguageContext>
  )
}

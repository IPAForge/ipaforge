import type { Logger } from '@ipaforge/kernel'
import type { SYSTEM_LANGUAGE } from '@ui/i18n/languages/language-store.ts'
import type { PSEUDO_LOCALE } from '@ui/i18n/languages/languages.ts'
import type status from '@ui/locales/status.json'
import type { PreferencesStore } from '@ui/services/preferences/preferences-store.ts'
import type { LocaleSource } from '@ui/services/system/locale-source.ts'

/** Every shipped language, from `locales/status.json` (one `locales/<id>.json` each). */
export type ShippedLanguage = keyof typeof status

export type LanguageId = ShippedLanguage | typeof PSEUDO_LOCALE

export type Direction = 'ltr' | 'rtl'

/** What the user picked in Settings: follow the system, or one language. */
export type LanguageChoice = typeof SYSTEM_LANGUAGE | LanguageId

export type LanguageState = {
  readonly choice: LanguageChoice
  /** The shipped language that best matches the OS languages. */
  readonly systemLanguage: ShippedLanguage
  /** The language shown: the choice, or `systemLanguage` when following the system. */
  readonly locale: LanguageId
}

export type LanguageStore = {
  getState: () => LanguageState
  subscribe: (listener: () => void) => () => void
  /** The language `choice` would show. */
  localeFor: (choice: LanguageChoice) => LanguageId
  /** Persists `choice` and shows it; call once its messages are loaded. */
  setChoice: (choice: LanguageChoice) => void
  /** Shows English, following the system, without touching the saved choice: for when no other bundle loads. */
  fallBackToSource: () => void
}

export type LanguageStoreOptions = {
  readonly preferences: PreferencesStore
  readonly localeSource: LocaleSource
  readonly logger: Logger
}

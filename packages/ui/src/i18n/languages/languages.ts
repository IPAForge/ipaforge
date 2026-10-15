import status from '@ui/locales/status.json'

/** Every shipped language, from `locales/status.json` (one `locales/<id>.json` each). */
export type ShippedLanguage = keyof typeof status
/** A pseudo-locale for spotting untranslated and truncated text; dev builds only. */
export const PSEUDO_LOCALE = 'en-XA'
export type LanguageId = ShippedLanguage | typeof PSEUDO_LOCALE
export type Direction = 'ltr' | 'rtl'

/** The source language: the fallback for missing translations and unmatched system languages. */
export const SOURCE_LANGUAGE: ShippedLanguage = 'en'
/** The status of a language whose translation was machine-drafted and awaits native-speaker review. */
const DRAFT_STATUS = 'draft'
const RTL_LANGUAGES: ReadonlySet<string> = new Set(['ar', 'he', 'fa', 'ur'])

const isShippedLanguage = (id: string): id is ShippedLanguage =>
  Object.hasOwn(status, id)

export const shippedLanguages: readonly ShippedLanguage[] =
  Object.keys(status).filter(isShippedLanguage)

/** Only vite dev builds (and tests) offer the pseudo-locale. */
export const pseudoLocaleEnabled: boolean = import.meta.env.DEV

/** The languages the picker offers: the shipped ones, plus the pseudo-locale in dev builds. */
export const availableLanguages: readonly LanguageId[] = pseudoLocaleEnabled
  ? [...shippedLanguages, PSEUDO_LOCALE]
  : shippedLanguages

export const isAvailableLanguage = (id: string | undefined): id is LanguageId =>
  availableLanguages.some((language) => language === id)

export const isDraftLanguage = (id: LanguageId): boolean =>
  isShippedLanguage(id) && status[id] === DRAFT_STATUS

export const directionOf = (locale: string): Direction =>
  RTL_LANGUAGES.has(new Intl.Locale(locale).language) ? 'rtl' : 'ltr'

/** A language's name in that language ("Deutsch", "日本語"), capitalised as it would start a list entry. */
export const nativeName = (locale: string): string => {
  const name =
    new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale

  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
}

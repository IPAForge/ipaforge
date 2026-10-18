import i18next, { type i18n } from 'i18next'
import ICU from 'i18next-icu'

import type { Logger } from '@ipaforge/kernel'
import { SOURCE_LANGUAGE } from '@ui/i18n/languages/languages.ts'
import type {} from '@ui/i18n/setup/types.ts'
import en from '@ui/locales/en.json'

export type CreateI18nOptions = {
  /** Scoped by the caller (`ui.i18n`). */
  readonly logger: Logger
  /** Logs a warning for every key `t()` can't find in any language; meant for development. */
  readonly warnOnMissingKeys: boolean
}

/**
 * A ready i18next instance with ICU message syntax, showing English, the only bundled language.
 * Other languages are added by the locale loader; their missing or empty messages fall back to English.
 */
export const createI18n = ({
  logger,
  warnOnMissingKeys
}: CreateI18nOptions): i18n => {
  const instance = i18next.createInstance()
  instance.use(new ICU())
  void instance.init({
    lng: SOURCE_LANGUAGE,
    fallbackLng: SOURCE_LANGUAGE,
    resources: { [SOURCE_LANGUAGE]: { translation: en } },
    partialBundledLanguages: true, // the rest arrive through addResourceBundle
    initAsync: false, // English is bundled: the first render already has its strings
    returnEmptyString: false,
    interpolation: { escapeValue: false }, // React escapes
    react: { useSuspense: false },
    saveMissing: warnOnMissingKeys,
    missingKeyHandler: (languages, _namespace, key) =>
      logger.warn('missing translation', {
        messageKey: key,
        languages: languages.join(',')
      })
  })
  instance.on('languageChanged', (language) =>
    logger.info('language changed', { locale: language })
  )
  return instance
}

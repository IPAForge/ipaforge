import { createLogger } from '@loadstar/kernel'
import type { LanguageId } from '@ui/i18n/languages/types.ts'
import { loadLocaleBundle } from '@ui/i18n/loading/locale-bundles.ts'
import { createLocaleLoader } from '@ui/i18n/loading/locale-loader.ts'
import { createI18n } from '@ui/i18n/setup/create-i18n.ts'

const silentLogger = createLogger({ level: 'error', sink: () => {} })
const options = { logger: silentLogger, warnOnMissingKeys: false }

/** A standalone i18next instance, the same as the app's, with `locale`'s real bundle loaded and shown. */
export const createTestI18n = async (locale: LanguageId = 'en') => {
  const i18n = createI18n(options)
  await createLocaleLoader({
    i18n,
    load: loadLocaleBundle,
    logger: silentLogger
  }).ensure(locale)
  await i18n.changeLanguage(locale)
  return i18n
}

/** English `t`, for the text tests expect on screen. */
export const { t } = createI18n(options)

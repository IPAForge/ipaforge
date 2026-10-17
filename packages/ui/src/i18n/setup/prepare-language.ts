import { createLanguageStore } from '@ui/i18n/languages/language-store.ts'
import type { LanguageChoice } from '@ui/i18n/languages/types.ts'
import { loadLocaleBundle } from '@ui/i18n/loading/locale-bundles.ts'
import { createLocaleLoader } from '@ui/i18n/loading/locale-loader.ts'
import { createI18n } from '@ui/i18n/setup/create-i18n.ts'
import type {
  LanguageSetup,
  PrepareLanguageOptions
} from '@ui/i18n/setup/types.ts'
import { scopeServices } from '@ui/services/scope-services.ts'
import type { UiServices } from '@ui/services/ui-services.ts'

const I18N_LOG_SCOPE = 'i18n'

/**
 * Resolves the language (saved choice, else the best match for the OS languages) and loads its messages,
 * so the host can mount `App` without an English flash. Falls back to English if that bundle won't load.
 */
export const prepareLanguage = async (
  services: UiServices,
  {
    load = loadLocaleBundle,
    warnOnMissingKeys = import.meta.env.DEV
  }: PrepareLanguageOptions = {}
): Promise<LanguageSetup> => {
  const {
    preferences,
    localeSource,
    logger: uiLogger
  } = scopeServices(services)
  const logger = uiLogger.child({ scope: I18N_LOG_SCOPE })
  const store = createLanguageStore({ preferences, localeSource, logger })
  const i18n = createI18n({ logger, warnOnMissingKeys })
  const loader = createLocaleLoader({ i18n, load, logger })

  const { locale } = store.getState()
  if (await loader.ensure(locale)) await i18n.changeLanguage(locale)
  else store.fallBackToSource()

  let latestRequest = 0
  const choose = async (choice: LanguageChoice): Promise<void> => {
    const request = ++latestRequest
    const next = store.localeFor(choice)
    const loaded = await loader.ensure(next)
    if (!loaded || request !== latestRequest) return // failed, or a later choice superseded this one
    await i18n.changeLanguage(next)
    store.setChoice(choice)
  }

  return { store, i18n, choose }
}

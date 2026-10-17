import type { LanguageId } from '@ui/i18n/languages/types.ts'
import type {
  LocaleLoader,
  LocaleLoaderOptions
} from '@ui/i18n/loading/types.ts'

const NAMESPACE = 'translation'

/** Adds language bundles to i18next on demand; concurrent requests share one fetch, and a failed one may be retried. */
export const createLocaleLoader = ({
  i18n,
  load,
  logger,
  now = () => performance.now()
}: LocaleLoaderOptions) => {
  const pending = new Map<LanguageId, Promise<boolean>>()

  const fetchBundle = async (language: LanguageId): Promise<boolean> => {
    const started = now()
    try {
      i18n.addResourceBundle(language, NAMESPACE, await load(language))
      logger.debug('language bundle loaded', {
        language,
        ms: Math.round(now() - started)
      })
      return true
    } catch (error) {
      pending.delete(language)
      logger.warn('language bundle failed to load', { language, error })
      return false
    }
  }

  const loader: LocaleLoader = {
    ensure: (language) => {
      if (i18n.hasResourceBundle(language, NAMESPACE))
        return Promise.resolve(true)
      const request = pending.get(language) ?? fetchBundle(language)
      pending.set(language, request)
      return request
    }
  }

  return loader
}

import type { i18n } from 'i18next'

import type { Logger } from '@loadstar/kernel'
import type { LanguageId } from '@ui/i18n/languages/languages.ts'
import type { LoadBundle } from '@ui/i18n/loading/locale-bundles.ts'

const NAMESPACE = 'translation'

export type LocaleLoader = {
  /** Resolves true once `language`'s messages are in i18next (fetched at most once), false if they can't be. */
  ensure: (language: LanguageId) => Promise<boolean>
}

export type LocaleLoaderOptions = {
  readonly i18n: i18n
  readonly load: LoadBundle
  /** Scoped by the caller (`ui.i18n`). */
  readonly logger: Logger
  /** Milliseconds; injectable for tests. */
  readonly now?: () => number
}

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

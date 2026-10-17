// Every language except English is its own chunk, fetched the first time it is shown.

import { PSEUDO_LOCALE } from '@ui/i18n/languages/languages.ts'
import type { LoadBundle } from '@ui/i18n/loading/types.ts'
import type { MessageTree } from '@ui/i18n/pseudo-locale.ts'
import en from '@ui/locales/en.json'

const JSON_EXTENSION = '.json'

// English is bundled with the app (the fallback and the type source); status.json is not a language.
const lazyFiles = import.meta.glob<MessageTree>(
  ['@ui/locales/*.json', '!@ui/locales/en.json', '!@ui/locales/status.json'],
  { import: 'default' }
)

/** "…/locales/pt-BR.json" → "pt-BR" */
const languageOf = (path: string): string =>
  path.slice(path.lastIndexOf('/') + 1, -JSON_EXTENSION.length)

const fileLoaders = new Map(
  Object.entries(lazyFiles).map(([path, load]) => [languageOf(path), load])
)

/** The pseudo-locale is derived from English, with the ICU parser in its own chunk. */
const loadPseudoLocale = async (): Promise<MessageTree> =>
  (await import('@ui/i18n/pseudo-locale.ts')).pseudoLocalizeTree(en)

export const loadLocaleBundle: LoadBundle = async (language) => {
  // Dev builds only; `import.meta.env.DEV` (not a re-exported flag) lets a production build drop the chunk.
  if (import.meta.env.DEV && language === PSEUDO_LOCALE)
    return loadPseudoLocale()
  const load = fileLoaders.get(language)
  if (!load) throw new Error(`no locale bundle for ${language}`)
  return load()
}

import { describe, expect, it } from 'vitest'

import {
  type LanguageId,
  PSEUDO_LOCALE,
  SOURCE_LANGUAGE,
  shippedLanguages
} from '@ui/i18n/languages/languages.ts'
import { loadLocaleBundle } from '@ui/i18n/loading/locale-bundles.ts'
import de from '@ui/locales/de.json'

describe('loadLocaleBundle', () => {
  it('has a lazy bundle for every shipped language except English', async () => {
    const lazy = shippedLanguages.filter(
      (language) => language !== SOURCE_LANGUAGE
    )
    const bundles = await Promise.all(lazy.map(loadLocaleBundle))
    expect(bundles.every((bundle) => typeof bundle.nav === 'object')).toBe(true)
    expect(await loadLocaleBundle('de')).toEqual(de)
  })

  it('builds the pseudo-locale on demand', async () => {
    expect(await loadLocaleBundle(PSEUDO_LOCALE)).toMatchObject({
      nav: { install: '[Îñšţåļļ~~~]' }
    })
  })

  it('rejects English, the status file and unknown languages', async () => {
    for (const language of ['en', 'status', 'xx']) {
      await expect(loadLocaleBundle(language as LanguageId)).rejects.toThrow(
        `no locale bundle for ${language}`
      )
    }
  })
})

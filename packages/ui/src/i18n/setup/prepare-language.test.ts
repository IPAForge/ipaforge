import { describe, expect, it } from 'vitest'

import { createControllableLoad } from '@ui/__tests__/controllable-load.ts'
import { createTestServices } from '@ui/__tests__/test-services.tsx'
import { LANGUAGE_PREFERENCE_KEY } from '@ui/i18n/languages/language-store.ts'
import { prepareLanguage } from '@ui/i18n/setup/prepare-language.ts'

const setup = async (
  languages: readonly string[],
  control = createControllableLoad(),
  preferences: Readonly<Record<string, string>> = {}
) => {
  const test = createTestServices({ languages, preferences })
  const language = await prepareLanguage(test.services, { load: control.load })

  return { ...test, ...control, language }
}

const settled = () => new Promise((resolve) => setTimeout(resolve))

describe('prepareLanguage', () => {
  it('loads the system language before resolving, and logs how long it took', async () => {
    const { language, records, load } = await setup(['de-DE'])
    expect(language.i18n.language).toBe('de')
    expect(language.i18n.t('nav.settings')).toBe('Einstellungen')
    expect(language.store.getState()).toMatchObject({
      choice: 'system',
      locale: 'de'
    })
    expect(load).toHaveBeenCalledWith('de')
    expect(records).toContainEqual(
      expect.objectContaining({
        level: 'debug',
        scope: 'ui.i18n',
        msg: 'language bundle loaded',
        fields: { language: 'de', ms: expect.any(Number) }
      })
    )
  })

  it('needs no load for English, which is bundled', async () => {
    const { language, load } = await setup(['en-GB'])
    expect(language.i18n.language).toBe('en')
    expect(load).not.toHaveBeenCalled()
  })

  it('falls back to English when the startup bundle fails, keeping the saved choice', async () => {
    const control = createControllableLoad(['ja'])
    control.fail('ja')
    const { language, records, services } = await setup(['en-US'], control, {
      [LANGUAGE_PREFERENCE_KEY]: 'ja'
    })
    expect(language.i18n.language).toBe('en')
    expect(language.store.getState()).toEqual({
      choice: 'system',
      systemLanguage: 'en',
      locale: 'en'
    })
    expect(services.preferences.read(LANGUAGE_PREFERENCE_KEY)).toBe('ja')
    expect(records).toContainEqual(
      expect.objectContaining({
        level: 'warn',
        msg: 'language bundle failed to load',
        scope: 'ui.i18n'
      })
    )
  })

  it('keeps the current language until the chosen one has loaded', async () => {
    const { language, release, services } = await setup(
      ['en-US'],
      createControllableLoad(['ar'])
    )
    const choosing = language.choose('ar')
    await settled()
    expect(language.i18n.language).toBe('en')
    expect(language.store.getState().choice).toBe('system')

    release('ar')
    await choosing
    expect(language.i18n.language).toBe('ar')
    expect(language.store.getState()).toMatchObject({
      choice: 'ar',
      locale: 'ar'
    })
    expect(services.preferences.read(LANGUAGE_PREFERENCE_KEY)).toBe('ar')
  })

  it('stays on the current language when a bundle fails, and may retry it later', async () => {
    const control = createControllableLoad(['ru'])
    const { language, services } = await setup(['en-US'], control)
    control.fail('ru')
    await language.choose('ru')
    expect(language.i18n.language).toBe('en')
    expect(language.store.getState().choice).toBe('system')
    expect(services.preferences.read(LANGUAGE_PREFERENCE_KEY)).toBeUndefined()

    control.load.mockImplementationOnce(async () => ({
      nav: { settings: 'Настройки' }
    }))
    await language.choose('ru')
    expect(language.i18n.language).toBe('ru')
  })

  it('loads each bundle once, even when asked again or concurrently', async () => {
    const { language, load } = await setup(['en-US'])
    await Promise.all([language.choose('ja'), language.choose('ja')])
    await language.choose('system')
    await language.choose('ja')
    expect(load.mock.calls).toEqual([['ja']])
  })

  it('applies only the latest choice when an earlier one resolves later', async () => {
    const { language, release } = await setup(
      ['en-US'],
      createControllableLoad(['de'])
    )
    const slow = language.choose('de')
    await language.choose('ro')
    release('de')
    await slow
    expect(language.i18n.language).toBe('ro')
    expect(language.store.getState().choice).toBe('ro')
  })
})

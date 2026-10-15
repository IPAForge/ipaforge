import { describe, expect, it, vi } from 'vitest'

import { createTestServices } from '@ui/__tests__/test-services.tsx'
import {
  createLanguageStore,
  LANGUAGE_PREFERENCE_KEY
} from '@ui/i18n/languages/language-store.ts'

const setup = (
  languages: readonly string[],
  saved: Readonly<Record<string, string>> = {}
) => {
  const { services, records } = createTestServices({
    preferences: saved,
    languages
  })
  const store = createLanguageStore(services)

  return { store, records, preferences: services.preferences }
}

describe('createLanguageStore', () => {
  it('follows the best match for the OS languages by default', () => {
    expect(setup(['fr-FR', 'ar-EG']).store.getState()).toEqual({
      choice: 'system',
      systemLanguage: 'ar',
      locale: 'ar'
    })
  })

  it('lets a saved choice override the system language, and ignores unknown ones', () => {
    expect(
      setup(['de-DE'], { [LANGUAGE_PREFERENCE_KEY]: 'ja' }).store.getState()
    ).toEqual({
      choice: 'ja',
      systemLanguage: 'de',
      locale: 'ja'
    })
    expect(
      setup(['de-DE'], {
        [LANGUAGE_PREFERENCE_KEY]: 'klingon'
      }).store.getState().choice
    ).toBe('system')
  })

  it('persists a new choice and notifies subscribers, but not for the same choice', () => {
    const { store, preferences } = setup(['en-US'])
    const listener = vi.fn()
    store.subscribe(listener)

    store.setChoice('ru')
    store.setChoice('ru')

    expect(preferences.read(LANGUAGE_PREFERENCE_KEY)).toBe('ru')
    expect(store.getState().locale).toBe('ru')
    expect(listener).toHaveBeenCalledTimes(1)

    store.setChoice('system')
    expect(store.getState().locale).toBe('en')
    expect(preferences.read(LANGUAGE_PREFERENCE_KEY)).toBe('system')
  })

  it('logs how the language was resolved', () => {
    const { records } = setup(['pt-BR', 'ro'])
    expect(records).toContainEqual(
      expect.objectContaining({
        level: 'debug',
        msg: 'language resolved',
        fields: { preferred: 'pt-BR,ro', systemLanguage: 'ro', locale: 'ro' }
      })
    )
  })
})

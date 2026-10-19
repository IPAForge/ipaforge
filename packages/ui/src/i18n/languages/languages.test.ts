import { describe, expect, it } from 'vitest'

import { applyLocale } from '@ui/i18n/languages/apply-locale.ts'
import {
  availableLanguages,
  directionOf,
  isDraftLanguage,
  nativeName,
  PSEUDO_LOCALE,
  shippedLanguages
} from '@ui/i18n/languages/languages.ts'

describe('languages', () => {
  it('ships the languages listed in status.json, and the pseudo-locale in dev', () => {
    expect(shippedLanguages).toEqual(['en', 'de', 'ro', 'ru', 'ar', 'ja'])
    expect(availableLanguages).toEqual([...shippedLanguages, PSEUDO_LOCALE])
  })

  it('marks no language as a draft once every translation is reviewed', () => {
    expect(shippedLanguages.filter(isDraftLanguage)).toEqual([])
    expect(isDraftLanguage(PSEUDO_LOCALE)).toBe(false)
  })

  it.each([
    ['ar', 'rtl'],
    ['ar-EG', 'rtl'],
    ['he', 'rtl'],
    ['fa-IR', 'rtl'],
    ['ur', 'rtl'],
    ['en', 'ltr'],
    ['ja', 'ltr'],
    ['en-XA', 'ltr']
  ])('%s is written %s', (locale, direction) => {
    expect(directionOf(locale)).toBe(direction)
  })

  it('names each language in itself, capitalised', () => {
    expect(shippedLanguages.map(nativeName)).toEqual([
      'English',
      'Deutsch',
      'Română',
      'Русский',
      'العربية',
      '日本語'
    ])
  })
})

describe('applyLocale', () => {
  it('sets lang and dir, and switches them back', () => {
    const root = document.createElement('html')
    applyLocale(root, 'ar')
    expect([root.getAttribute('lang'), root.getAttribute('dir')]).toEqual([
      'ar',
      'rtl'
    ])
    applyLocale(root, 'de')
    expect([root.getAttribute('lang'), root.getAttribute('dir')]).toEqual([
      'de',
      'ltr'
    ])
  })
})

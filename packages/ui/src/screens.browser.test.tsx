// Every main screen in a real browser: a reference image per language (English, German for long words, Arabic
// right to left, Japanese, and the pseudo-locale for cut-off text) and colour mode, no translated text clipped,
// no text running out of its box, and no WCAG 2.2 AA violation that axe can find.
import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import {
  accessibilityViolations,
  appsShown,
  clippedTranslations,
  fillPreload,
  logsShown,
  planShown,
  pressInstall,
  recoveryShown,
  renderScreen,
  repairShown,
  type ScreenOptions,
  showSources,
  textOutsideItsBox
} from '@ui/__tests__/screens.ts'
import type { LanguageId } from '@ui/i18n/languages/types.ts'

const LANGUAGES: readonly LanguageId[] = ['en', 'de', 'ar', 'ja', 'en-XA']

const screens = {
  'install-home': async (options: ScreenOptions) => {
    await renderScreen('/install', options)
    await planShown()
  },
  'install-failed': async (options: ScreenOptions) => {
    await renderScreen('/install', { ...options, scenario: 'device-locked' })
    await planShown()
    await pressInstall()
    await recoveryShown()
  },
  preload: async (options: ScreenOptions) => {
    await renderScreen('/preload', options)
    await fillPreload()
  },
  'preload-sources': async (options: ScreenOptions) => {
    await renderScreen('/preload', options)
    await showSources()
  },
  apps: async (options: ScreenOptions) => {
    await renderScreen('/apps', options)
    await appsShown()
  },
  repair: async (options: ScreenOptions) => {
    await renderScreen('/apps/sidestore', {
      ...options,
      scenario: 'sidestore-unknown'
    })
    await repairShown()
  },
  logs: async (options: ScreenOptions) => {
    await renderScreen('/logs', options)
    await logsShown()
  },
  settings: async (options: ScreenOptions) => {
    await renderScreen('/settings', options)
  }
} satisfies Record<string, (options: ScreenOptions) => Promise<void>>

const SCREENS = Object.keys(screens) as (keyof typeof screens)[]

const whole = () => page.elementLocator(document.body)

describe.each(LANGUAGES)('in %s', (language) => {
  it.each(SCREENS)('%s', async (screen) => {
    await screens[screen]({ language })

    expect(clippedTranslations()).toEqual([])
    expect(textOutsideItsBox()).toEqual([])
    await expect(whole()).toMatchScreenshot(`${screen}-${language}`)
  })
})

describe('in dark mode', () => {
  it.each(SCREENS)('%s', async (screen) => {
    await screens[screen]({ mode: 'dark' })

    await expect(whole()).toMatchScreenshot(`${screen}-en-dark`)
  })
})

describe('accessibility', () => {
  const cases = SCREENS.flatMap((screen) =>
    (['light', 'dark'] as const).map((mode) => [screen, mode] as const)
  )

  it.each(cases)('%s in %s mode', async (screen, mode) => {
    await screens[screen]({ mode })

    expect(await accessibilityViolations()).toEqual([])
  })

  it('right to left too', async () => {
    await screens['install-home']({ language: 'ar' })

    expect(await accessibilityViolations()).toEqual([])
  })
})

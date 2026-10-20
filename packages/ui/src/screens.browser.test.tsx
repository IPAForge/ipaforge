// Every main screen in a real browser: a reference image per language (English, German for long words, Arabic
// right to left, Japanese, and the pseudo-locale for cut-off text) and colour mode, no translated text clipped,
// no text running out of its box, and no WCAG 2.2 AA violation that axe can find.
import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import {
  accessibilityViolations,
  appsShown,
  checklistShown,
  clippedTranslations,
  developerShown,
  fillPreload,
  logsShown,
  openAddAllToSideStore,
  planShown,
  pressInstall,
  recoveryShown,
  renderChangelog,
  renderScreen,
  renderUpdateScreen,
  renderWhatsNew,
  repairShown,
  type ScreenOptions,
  showSources,
  textOutsideItsBox
} from '@ui/__tests__/screens.ts'
import type { LanguageId } from '@ui/i18n/languages/types.ts'

const LANGUAGES: readonly LanguageId[] = ['en', 'de', 'ar', 'ja', 'en-XA']
const NEXT = '0.1.0-alpha.99'
const RELEASE = `https://github.com/IPAForge/ipaforge/releases/tag/v${NEXT}`

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
  'sidestore-qr': async (options: ScreenOptions) => {
    await renderScreen('/preload', { ...options, scenario: 'sources-added' })
    await showSources()
    await openAddAllToSideStore()
  },
  devices: async (options: ScreenOptions) => {
    await renderScreen('/devices', { ...options, scenario: 'checklist-todo' })
    await checklistShown()
  },
  apps: async (options: ScreenOptions) => {
    await renderScreen('/apps', options)
    await appsShown()
  },
  developer: async (options: ScreenOptions) => {
    await renderScreen('/developer', options)
    await developerShown()
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
  },
  'whats-new': renderWhatsNew,
  changelog: renderChangelog,
  'update-downloading': async (options: ScreenOptions) => {
    await renderUpdateScreen(
      {
        phase: 'downloading',
        version: NEXT,
        transferred: 41_000_000,
        total: 102_000_000,
        bytesPerSecond: 6_400_000
      },
      options
    )
  },
  'update-failed': async (options: ScreenOptions) => {
    await renderUpdateScreen(
      {
        phase: 'failed',
        version: NEXT,
        reason: 'net::ERR_CONNECTION_RESET',
        url: RELEASE
      },
      options
    )
  },
  'update-manual': async (options: ScreenOptions) => {
    await renderUpdateScreen(
      {
        phase: 'manual',
        version: NEXT,
        packageType: 'deb',
        fileName: `IPAForge-${NEXT}-linux-amd64.deb`,
        url: RELEASE
      },
      options
    )
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

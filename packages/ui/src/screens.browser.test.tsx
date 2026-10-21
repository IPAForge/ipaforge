// Every main screen in a real browser, in every language checked (English, German for long words, Arabic right to
// left, Japanese, and the pseudo-locale for cut-off text): no translated text clipped, no text running out of its
// box, and no WCAG 2.2 AA violation that axe can find, in light and dark mode. No images are kept: the website's
// screenshots are made on demand (website-screens.browser.test.tsx, `pnpm --filter @ipaforge/ui screenshots`).
import { describe, expect, it } from 'vitest'

import { screens } from '@ui/__tests__/screen-table.ts'
import {
  accessibilityViolations,
  clippedTranslations,
  textOutsideItsBox
} from '@ui/__tests__/screens.ts'
import type { LanguageId } from '@ui/i18n/languages/types.ts'

const LANGUAGES: readonly LanguageId[] = ['en', 'de', 'ar', 'ja', 'en-XA']

const SCREENS = Object.keys(screens) as (keyof typeof screens)[]

describe.each(LANGUAGES)('in %s', (language) => {
  it.each(SCREENS)('%s', async (screen) => {
    await screens[screen]({ language })

    expect(clippedTranslations()).toEqual([])
    expect(textOutsideItsBox()).toEqual([])
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

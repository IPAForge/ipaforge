// The website's screenshots, made on demand (`pnpm --filter @ipaforge/ui screenshots`, in Playwright's Docker image so
// fonts match CI): the screens ipaforge.com shows, in English, light and dark. Skipped in every other run, and the
// images are never kept in the repository.
import { describe, it } from 'vitest'
import { page } from 'vitest/browser'

import { screens } from '@ui/__tests__/screen-table.ts'

const WEBSITE_SCREENS = [
  'install-home',
  'preload',
  'preload-save',
  'apps',
  'developer',
  'repair',
  'devices',
  'sidestore-qr'
] as const satisfies readonly (keyof typeof screens)[]

const MODES = ['light', 'dark'] as const

describe.runIf(import.meta.env.VITE_WEBSITE_SCREENSHOTS === '1')(
  'website screenshots',
  () => {
    const cases = WEBSITE_SCREENS.flatMap((screen) =>
      MODES.map((mode) => [screen, mode] as const)
    )

    it.each(cases)('%s in %s mode', async (screen, mode) => {
      await screens[screen]({ mode })
      await page.screenshot({
        path: `website/${screen}${mode === 'dark' ? '-dark' : ''}.png`
      })
    })
  }
)

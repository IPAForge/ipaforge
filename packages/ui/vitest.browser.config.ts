// Screenshot and accessibility tests (`*.browser.test.tsx`) in a real Chromium, through Vitest's browser mode.
// Reference images are made on Linux only (CI, or `pnpm test:browser:update` in Playwright's Docker image):
// fonts render differently on every system, so other systems would only ever compare against themselves.
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineProject } from 'vitest/config'

import { workspaceAliases } from '../../tooling/vite/workspace-aliases.ts'

const VIEWPORT = { width: 1280, height: 800 }

export default defineProject({
  plugins: [react(), tailwindcss()],
  resolve: { alias: workspaceAliases },
  test: {
    name: 'ui-browser',
    include: ['src/**/*.browser.test.tsx'],
    setupFiles: ['src/__tests__/browser-setup.ts'],
    testTimeout: 30_000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        contextOptions: {
          locale: 'en-US',
          timezoneId: 'UTC',
          colorScheme: 'light',
          reducedMotion: 'reduce'
        }
      }),
      instances: [{ browser: 'chromium', viewport: VIEWPORT }],
      expect: {
        toMatchScreenshot: {
          comparatorName: 'pixelmatch',
          // Anti-aliasing differs by a few pixels between runs of the same browser; real changes are far larger.
          comparatorOptions: {
            threshold: 0.1,
            allowedMismatchedPixelRatio: 0.002
          }
        }
      }
    }
  }
})

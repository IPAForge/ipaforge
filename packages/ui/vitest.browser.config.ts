// Layout and accessibility tests (`*.browser.test.tsx`) in a real Chromium, through Vitest's browser mode: cut-off
// translations, text out of its box and WCAG violations, on every main screen. No reference images are kept; the
// website's screenshots are taken on demand (scripts/website-screenshots.sh).
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
      instances: [{ browser: 'chromium', viewport: VIEWPORT }]
    }
  }
})

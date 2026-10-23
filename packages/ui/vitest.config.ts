import react from '@vitejs/plugin-react'
import { configDefaults, defineProject } from 'vitest/config'

import { testDefaults } from '../../tooling/vite/test-defaults.ts'
import { workspaceAliases } from '../../tooling/vite/workspace-aliases.ts'

export default defineProject({
  plugins: [react()],
  resolve: { alias: workspaceAliases },
  test: {
    ...testDefaults,
    environment: 'happy-dom',
    // Those run in a real browser: vitest.browser.config.ts.
    exclude: [...configDefaults.exclude, '**/*.browser.test.tsx'],
    setupFiles: [...testDefaults.setupFiles, 'src/__tests__/setup.ts']
  }
})

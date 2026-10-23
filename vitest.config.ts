import { defineConfig } from 'vitest/config'

import { testDefaults } from './tooling/vite/test-defaults.ts'

export default defineConfig({
  test: {
    projects: [
      'packages/*',
      'apps/*',
      {
        test: {
          ...testDefaults,
          name: 'scripts',
          include: ['scripts/*.test.ts', 'tooling/**/*.test.ts']
        }
      }
    ],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'scripts/**'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/__fixtures__/**']
    }
  }
})

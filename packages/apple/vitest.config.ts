import { defineProject } from 'vitest/config'

import { testDefaults } from '../../tooling/vite/test-defaults.ts'
import { workspaceAliases } from '../../tooling/vite/workspace-aliases.ts'

export default defineProject({
  resolve: { alias: workspaceAliases },
  test: testDefaults
})

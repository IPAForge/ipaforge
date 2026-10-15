import { defineProject } from 'vitest/config'

import { workspaceAliases } from '../../tooling/vite/workspace-aliases.ts'

export default defineProject({
  resolve: { alias: workspaceAliases }
})

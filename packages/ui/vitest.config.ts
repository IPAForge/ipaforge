import react from '@vitejs/plugin-react'
import { defineProject } from 'vitest/config'

import { workspaceAliases } from '../../tooling/vite/workspace-aliases.ts'

export default defineProject({
  plugins: [react()],
  resolve: { alias: workspaceAliases },
  test: {
    environment: 'happy-dom',
    setupFiles: ['src/__tests__/setup.ts']
  }
})

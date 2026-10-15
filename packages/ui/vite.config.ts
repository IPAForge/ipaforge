// The UI in a plain browser: `pnpm --filter @loadstar/ui dev` and `build` (into `dist/`).
// The Electron renderer mounts `App` with its own Vite config.
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { workspaceAliases } from '../../tooling/vite/workspace-aliases.ts'

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), tailwindcss()],
  resolve: { alias: workspaceAliases }
})

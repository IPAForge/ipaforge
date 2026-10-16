// The UI in a plain browser: `pnpm --filter @loadstar/ui dev` and `build` (into `dist/`).
// The Electron renderer mounts `App` with its own Vite config.
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { workspaceAliases } from '../../tooling/vite/workspace-aliases.ts'
import packageJson from './package.json' with { type: 'json' }

const DEV_PORT = 5180

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), tailwindcss()],
  resolve: { alias: workspaceAliases },
  // A fixed port of its own, so it never lands on another project's dev server; it fails rather than move.
  server: { port: DEV_PORT, strictPort: true },
  // Shown in copied diagnostics.
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
  }
})

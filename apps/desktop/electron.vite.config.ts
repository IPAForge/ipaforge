// The desktop app's three builds: main (Node), preload (sandboxed) and renderer (the UI from @loadstar/ui).
// `pnpm --filter @loadstar/desktop dev | build | preview`; output goes to `out/`.
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import type { Plugin } from "vite";
import { workspaceAliases } from "../../tooling/vite/workspace-aliases.ts";
import {
  DEVELOPMENT_CONTENT_SECURITY_POLICY,
  PRODUCTION_CONTENT_SECURITY_POLICY,
} from "./src/shared/content-security-policy.ts";

const resolve = { alias: workspaceAliases };

/** Workspace packages export TypeScript sources, so they are bundled rather than required at runtime. */
const bundleEverything = { externalizeDeps: false };

/** Adds the Content-Security-Policy meta tag: the strict policy in a build, a looser one for the dev server. */
const contentSecurityPolicy = (): Plugin => ({
  name: "loadstar:content-security-policy",
  transformIndexHtml: (_html, context) => [
    {
      tag: "meta",
      attrs: {
        "http-equiv": "Content-Security-Policy",
        content: context.server ? DEVELOPMENT_CONTENT_SECURITY_POLICY : PRODUCTION_CONTENT_SECURITY_POLICY,
      },
      injectTo: "head-prepend",
    },
  ],
});

export default defineConfig({
  main: { resolve, build: bundleEverything },
  preload: {
    resolve,
    // A sandboxed preload runs as a classic script, so it must be CommonJS even in an ESM package.
    build: { ...bundleEverything, rolldownOptions: { output: { format: "cjs" } } },
  },
  renderer: {
    resolve,
    plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*", { test: { name: "scripts", include: ["scripts/*.test.ts"] } }],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**", "scripts/**"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/__fixtures__/**"],
    },
  },
});

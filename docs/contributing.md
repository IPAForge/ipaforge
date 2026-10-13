[← Roadmap](roadmap.md) · [Back to README](../README.md)

# Contributing

## Conventions (summary)

- TypeScript strict, ESM only. Files are `kebab-case.ts`.
- Arrow functions only (`const name = () => …`). `function` declarations fail lint through a Biome GritQL plugin.
- Absolute imports only: `@signer/domain/…` inside a package, `@loadstar/kernel` across packages. Relative imports fail `pnpm check:boundaries`.
- `packages/*` are platform-free: no `node:*`, `electron` or DOM-only APIs. `pnpm check:boundaries` enforces this.
- Errors are `LoadstarError` with an `ErrorCode`. External input is validated with zod.
- Binary code always states its endianness: Mach-O is little-endian, signature blobs are big-endian.
- UI uses HeroUI components and Tailwind utilities only. No CSS files, and every string goes through i18next.
- Log through the `Logger` port. Secrets are redacted by default.

The full rules are in [design/conventions.md](design/conventions.md).

## Boundary checker

`pnpm check:boundaries` (`scripts/check-boundaries.ts`) scans `packages/*/src` and fails on:

| Rule | Example | Fix |
|---|---|---|
| `node-builtin` | `import { readFile } from "node:fs"` | Use a port (`FileSource`), implement it in `apps/*` |
| `platform-module` | `import { app } from "electron"` | Move it to `apps/desktop` |
| `deep-import` | `@loadstar/kernel/src/bytes` | Import `@loadstar/kernel` |
| `forbidden-edge` | `signer` importing `@loadstar/device` | Orchestrate in `installer` |
| `unknown-package` | a new package missing from the edge table | Add it to `scripts/boundaries.config.ts` |
| `escape` | `../../other-package/src/x.ts` | Import the package by name |
| `relative-import` | `./sibling.ts` | Use the package alias: `@signer/domain/sibling.ts` |
| `foreign-subpath` | `@kernel/bytes/index.ts` inside `signer` | Import `@loadstar/kernel` |

Biome's `noRestrictedImports` also flags Node built-ins inside `packages/**` while you edit.

## Adding a package

1. Create `packages/<name>/` with:
   - `package.json`: `"name": "@loadstar/<name>"`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }`, and a `typecheck` script;
   - `tsconfig.json`: extends `../../tsconfig.base.json` with `"lib": ["ES2023", "WebWorker"]` and `"types": []` (the isomorphic baseline).
2. Add the package and its allowed dependencies to `scripts/boundaries.config.ts`, add its `@<name>/*` alias to `tsconfig.base.json` `paths`, and add a `vitest.config.ts` that uses `workspaceAliases` (copy one from `packages/kernel`).
3. Export the public API from `src/index.ts` only. Put tests next to the source as `*.test.ts`.

Workspace packages are **source-only**: there is no build step. The apps' bundlers (Vite, electron-vite) compile them directly.

## Clean-room policy

Use public specs and permissively licensed projects (libimobiledevice docs, SideStore, rcodesign, zsign) as **references**. Never copy code from other sideloading tools, from GPL/AGPL projects (e.g. ldid) or from proprietary-licensed ones (e.g. ipa-resign).

## See Also

- [Architecture](architecture.md): dependency rules in detail
- [Roadmap](roadmap.md): pick up a phase

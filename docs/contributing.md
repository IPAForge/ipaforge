[← Roadmap](roadmap.md) · [Back to README](../README.md)

# Contributing

Thanks for helping. Loadstar is an open-source desktop app (Windows, macOS, Linux) that installs SideStore and other apps on iPhone and iPad.

## How changes get in

1. **Open an issue first** for anything bigger than a small fix, so we can agree on the approach.
2. **Fork** the repository and create a branch: `feat/…`, `fix/…`, `docs/…` or `chore/…`.
3. Make the change. Run the checks locally (CI runs the same):
   ```bash
   pnpm install
   pnpm run verify   # lint, typecheck, boundaries, tests
   ```
4. **Open a pull request into `main`.** Fill in the template: what changed, why, and how you verified it.
5. CI must pass on Linux, Windows and macOS. The maintainer reviews it.
6. **Only the maintainer merges** (squash merge, one commit per PR). Nobody pushes to `main` directly.

## What we look for

- **Small, focused PRs.** One topic per PR.
- **Tests** for new behaviour: `domain/` and `application/` code always gets unit tests.
- **Conventions** (enforced by lint and `pnpm check:boundaries`):
  - TypeScript strict, ESM only;
  - arrow functions only;
  - absolute `@<package>/…` imports;
  - `packages/*` stay platform-free (no `node:*`, no `electron`).
- **Errors are catalogued.** User-facing failures use an `ErrorCode` with a documented meaning and fix.
- **No secrets** in code, tests, logs, issues or screenshots: no Apple ID passwords, tokens, pairing files, `.p12` files or device UDIDs.

## Scope

Loadstar helps people install apps they already have, on their own devices, within Apple's free and paid developer account rules. Changes that decrypt App Store apps, circumvent Apple's limits or security measures, or target other people's devices are out of scope and will be closed.

## Licence

By contributing, you agree that your contribution is licensed under the [MIT licence](../LICENSE) of this project.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues go through [SECURITY.md](SECURITY.md), never public issues.

## Pull requests and `main`

- **`main` is protected.** It only changes through pull requests. There are no direct pushes, force pushes or deletions.
- **Before a PR can merge:**
  - CI passes on Linux, Windows and macOS, including macOS codesign parity;
  - the branch is up to date with `main`;
  - review threads are resolved;
  - the code owner (`.github/CODEOWNERS`) approves.
- **Merging:** squash merge only, so `main` keeps a linear history with one commit per PR. Only the maintainer merges.
- **Contributors' own forks:** contributors work in forks and do not need write access. CI on pull requests from first-time contributors waits for the maintainer's approval, and runs with a read-only token and no secrets.

## Conventions (summary)

- TypeScript strict, ESM only. Files are `kebab-case.ts`.
- Arrow functions only (`const name = () => …`). `function` declarations fail lint through a Biome GritQL plugin.
- Absolute imports only: `@signer/domain/…` inside a package, `@loadstar/kernel` across packages. Relative imports fail `pnpm check:boundaries`.
- `packages/*` are platform-free: no `node:*`, `electron` or DOM-only APIs. `pnpm check:boundaries` enforces this.
- Errors are `LoadstarError` with an `ErrorCode`. External input is validated with zod.
- No magic values: format constants go in named constants modules, and tunables go in `domain/config.ts` with overridable defaults.
- Binary code always states its endianness: Mach-O is little-endian, signature blobs are big-endian.
- UI uses HeroUI components and Tailwind utilities only. No CSS files, and every string goes through i18next (a Biome plugin rejects text in JSX).
- Log through the `Logger` port. Secrets are redacted by default.

The full rules are in [design/conventions.md](design/conventions.md).

## Translating

The UI's strings live in `packages/ui/src/locales/`: one JSON file per language, with `en.json` as the source of truth, and `status.json` listing every language as `source`, `draft` or `reviewed`.

- **Improve a language:** edit its file. Keep every key, and keep ICU placeholders (`{count}`, `{language}`) and plural syntax intact; use your language's plural categories (`one`, `few`, `many`, …). An empty string means "not translated yet" and shows English.
- **Review a draft:** most languages start as machine drafts marked `"draft"` in `status.json`, and the picker labels them. A native speaker who has read the whole file sets it to `"reviewed"` in the same pull request.
- **Add a language:** copy `en.json` to `<code>.json`, translate it, and add `"<code>": "draft"` to `status.json`. Nothing else needs registering: each file becomes its own chunk, loaded when the language is chosen.

`pnpm check:locales` checks missing or extra keys, ICU syntax and placeholders, and prints each language's completion. See [ui.md](ui.md#translations) for the details.

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
   - `tsconfig.json`: extends `../../tsconfig.base.json` with `"lib": ["ES2023", "WebWorker"]` and `"types": []` (the platform-free baseline).
2. Add the package and its allowed dependencies to `scripts/boundaries.config.ts`, add its `@<name>/*` alias to `tsconfig.base.json` `paths`, and add a `vitest.config.ts` that uses `workspaceAliases` (copy one from `packages/kernel`).
3. Export the public API from `src/index.ts` only. Put tests next to the source as `*.test.ts`.

Workspace packages are **source-only**: there is no build step. The apps' bundlers (Vite, electron-vite) compile them directly.

## Clean-room policy

Use public specs and permissively licensed projects (libimobiledevice docs, SideStore, rcodesign, zsign) as **references**. Never copy code from other sideloading tools, from GPL/AGPL projects (e.g. ldid) or from proprietary-licensed ones (e.g. ipa-resign).

## See Also

- [Architecture](architecture.md): dependency rules in detail
- [Roadmap](roadmap.md): pick up a phase

# AGENTS.md

> A structural map of the repository for AI agents and new contributors. Keep it up to date when the structure changes.

## Project Overview

Loadstar is an open-source desktop tool (Windows, macOS, Linux) for installing SideStore and preloading other apps onto iOS devices, built on a pure-TypeScript engine. Details: `docs/design/overview.md`.

## Tech Stack

- **Programming language:** TypeScript 7 (strict, ESM)
- **Framework:** React 19 + HeroUI v3 + Tailwind v4 (UI); Electron 44 + electron-vite (desktop)
- **Database:** none (OS keychain via Electron `safeStorage`)
- **ORM:** none

## Project Structure

> Planned layout. Directories appear as roadmap milestones land. **Exists today:** `packages/kernel`, `packages/signer`, `packages/device`, `packages/apple`, `packages/catalog`, `packages/installer`, `packages/rpc`, `packages/ui` (palettes, top bar and sidebar shell, routes, i18n with six languages; runs in a browser via its own Vite config), `catalog/sources.json`, `apps/desktop` (Node adapters, `createDesktopEngine`, the RPC transport and IPA resolver, maintainer probes, and the Electron shell: one hardened window rendering `@loadstar/ui`, connected to the Engine in main over a MessagePort), `fixtures/signer`, `scripts/`, `.github/workflows/`.

```
loadstar/
├── packages/
│   ├── kernel/       # LoadstarError/ErrorCode, ports (Logger, HttpClient, SecretStore, FileSource), bytes utils, plist
│   ├── signer/       # Mach-O code signing (CodeDirectory, CodeResources, entitlements, CMS, fat, bundles, IPA)
│   ├── device/       # usbmux, lockdown, pairing, AFC, house_arrest, installation_proxy
│   ├── apple/        # GSA auth + 2FA, anisette provider chain, developer services API
│   ├── catalog/      # release sources (GitHub API), downloads, cache
│   ├── installer/    # pipelines/flows, diagnostics, Engine facade
│   ├── rpc/          # typed Engine ⇄ UI RPC (Electron IPC)
│   └── ui/           # shared React app (features, theme palettes, i18n)
├── apps/
│   └── desktop/      # Electron composition root + Node adapters
├── scripts/          # check-boundaries.ts (+ boundaries.config.ts edge table), check-locales.ts
├── tooling/          # Biome GritQL lint plugins, shared Vite aliases, ESLint plugins (own package: TypeScript 6 for the parser)
├── fixtures/         # golden Apple codesign outputs for signer tests
└── docs/             # user, contributor and design documentation
```

## Key Entry Points

| File | Purpose |
|------|---------|
| `packages/installer/src/engine.ts` | The Engine facade: every capability the UI can call (`installSideStore`, `installApps`, `placePairing`, queries, `classify`) |
| `packages/installer/src/index.ts` | Public installer API (Engine, flows, prompts, diagnostics catalogue, pipeline runner) |
| `packages/signer/src/index.ts` | Public signer API (`inspectIpa`, `planSideloadIdentity`, `signIpa`, `signBundle`, `signBinary`, `reconcileForSideload`, plist, IPA I/O) |
| `fixtures/signer/generate.sh` | Regenerates the Apple `codesign` golden fixtures (macOS) |
| `packages/signer/scripts/compare-real-cert.ts` | Maintainer check against a real Apple Development `.p12` |
| `packages/device/src/index.ts` | Public device API (`createDeviceManager`: pairing, install, profiles, app files, checks) |
| `apps/desktop/src/main/adapters/` | Node adapters: usbmuxd transport, pinned TLS, file source |
| `apps/desktop/scripts/device-probe.ts` | Maintainer CLI against a real device |
| `packages/apple/src/index.ts` | Public Apple API (`createAppleAccounts`: anisette, sign-in + 2FA, app tokens, saved accounts) |
| `apps/desktop/scripts/apple-probe.ts` | Maintainer CLI: sign in with real Apple IDs |
| `apps/desktop/src/main/engine.ts` | `createDesktopEngine()`: the Engine built from the Node adapters |
| `apps/desktop/scripts/install-probe.ts` | Maintainer CLI: run the install flows against a real device and Apple account |
| `catalog/sources.json` | What can be installed and where releases come from (fetched by the app from `main`) |
| `packages/catalog/src/index.ts` | Public catalog API (`createCatalog`: manifest, release resolution with mirrors, verified downloads) |
| `packages/rpc/src/index.ts` | Public RPC API (`createRpcServer`, `createEngineClient`, `EngineClient`, `Transport`, in-memory transport) |
| `apps/desktop/src/main/rpc/` | Electron `MessagePortMain` transport and the IPA resolver (file path, URL download) |
| `apps/desktop/src/main/index.ts` | Electron main: app lifecycle, hardening, the Engine (`createDesktopEngine`, secrets via `main/secrets.ts`) and the window |
| `apps/desktop/src/main/rpc/serve-engine.ts` | Serves the Engine to the window: a fresh `MessageChannelMain` per page load, `createRpcServer` on one end, the other posted to the page |
| `apps/desktop/src/preload/forward-port.ts` | The preload's only job: forward the rpc port to the page (no `contextBridge` API) |
| `apps/desktop/src/renderer/engine-port.ts` | Renderer: receives the port and wraps it in a `Transport` for `createEngineClient` |
| `apps/desktop/src/renderer/main.tsx` | Electron renderer: connects the `EngineClient`, then mounts `@loadstar/ui` with the browser services and a hash history |
| `apps/desktop/electron.vite.config.ts` | electron-vite builds for main, preload and renderer (`pnpm --filter @loadstar/desktop dev` / `build`) |
| `packages/ui/src/services/engine/fake/fake-engine.ts` | The fake Engine the browser dev host and UI tests use (`?scenario=` in dev) |
| `packages/installer/src/application/device-watch.ts` | The device feed (usbmuxd `Listen`, reconnect, fallback polling) behind `engine.watchDevices` |
| `packages/ui/src/hooks/queries/` | TanStack Query hooks for every Engine query, the query client defaults and the device feed; keys in `query-keys.ts` |
| `packages/ui/src/App.tsx` | UI root that every host mounts: providers (services, query, language, theme) + router with the shell |
| `packages/ui/src/locales/en.json` | English UI strings, the source of truth for every translation (`status.json` lists languages and drafts) |
| `packages/ui/src/i18n/` | i18next setup, typed keys, language matching and store, on-demand locale loading (`prepareLanguage`), pseudo-locale, `Intl` formatters |
| `packages/ui/src/main.tsx` | Browser entry for the UI (`pnpm --filter @loadstar/ui dev` / `build`) |
| `pnpm-workspace.yaml` / `turbo.json` | Workspace and task graph |
| `packages/kernel/src/index.ts` | LoadstarError/ErrorCode, ports, logger, byte utilities |
| `scripts/check-boundaries.ts` | Architecture dependency-rule checker |
| `biome.json` / `eslint.config.js` | Code style: Biome formats and lints, ESLint only adds blank lines |
| `scripts/check-locales.ts` | Locale checker: keys, ICU syntax and placeholders vs `en.json`, completion per language |
| `.github/workflows/ci.yml` | Lint, typecheck, boundaries, locales and tests on Linux, Windows and macOS |

## Documentation

| Document | Path | Description |
|----------|------|-------------|
| README | README.md | Project landing page |
| Installing | docs/installing.md | Download, requirements per OS, first run |
| Getting Started | docs/getting-started.md | Status, requirements, dev setup |
| Architecture | docs/architecture.md | Packages, ports & adapters, dependency rules |
| Code Signing | docs/signing.md | How signing works and how it is verified |
| Device | docs/device.md | usbmuxd per OS, pairing, services, device errors |
| Apple Account | docs/apple-account.md | Sign-in, anisette, 2FA, saved accounts, errors |
| User Interface | docs/ui.md | Running in a browser, folder structure, UiServices, palettes and themes, shell, translations and RTL, styling rules |
| Install Flows | docs/install-flows.md | installSideStore, installApps, placePairing: steps, prompts, free-app limit, recovery, install-probe |
| Engine RPC | docs/rpc.md | Engine ⇄ UI message protocol, run streaming, checkpoints, error transport, Electron adapter |
| Roadmap | docs/roadmap.md | Phases with links to plans |
| Contributing | docs/contributing.md | PR rules, conventions, clean-room policy |
| Code of Conduct | docs/CODE_OF_CONDUCT.md | Contributor Covenant 2.1 |
| Security Policy | docs/SECURITY.md | Private vulnerability reporting |
| Signer format spec | docs/design/signer-spec.md | Byte-level iOS code-signing reference |

## Design documents

| File | Purpose |
|------|---------|
| AGENTS.md | This file: a structural map |
| docs/design/overview.md | Project specification and tech stack |
| docs/design/architecture.md | Architecture decisions and dependency rules |
| docs/design/roadmap.md | Milestones |
| docs/design/research.md | Research and verified findings |
| docs/design/conventions.md | Coding conventions |

## Agent Rules

- Respect the dependency rules in `docs/design/architecture.md`. `packages/*` must stay platform-free.


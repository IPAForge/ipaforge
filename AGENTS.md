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

> Planned layout. Directories appear as roadmap milestones land. **Exists today:** `packages/kernel`, `packages/signer`, `packages/device`, `packages/apple`, `packages/catalog`, `catalog/sources.json`, `apps/desktop` (Node adapters only), `fixtures/signer`, `scripts/`, `.github/workflows/`.

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
├── scripts/          # check-boundaries.ts (+ boundaries.config.ts edge table)
├── fixtures/         # golden Apple codesign outputs for signer tests
└── docs/             # user, contributor and design documentation
```

## Key Entry Points

| File | Purpose |
|------|---------|
| `packages/installer/src/engine.ts` | The Engine facade: every capability the UI can call |
| `packages/signer/src/index.ts` | Public signer API (`inspectIpa`, `planSideloadIdentity`, `signIpa`, `signBundle`, `signBinary`, `reconcileForSideload`, plist, IPA I/O) |
| `fixtures/signer/generate.sh` | Regenerates the Apple `codesign` golden fixtures (macOS) |
| `packages/signer/scripts/compare-real-cert.ts` | Maintainer check against a real Apple Development `.p12` |
| `packages/device/src/index.ts` | Public device API (`createDeviceManager`: pairing, install, profiles, app files, checks) |
| `apps/desktop/src/main/adapters/` | Node adapters: usbmuxd transport, pinned TLS, file source |
| `apps/desktop/scripts/device-probe.ts` | Maintainer CLI against a real device |
| `packages/apple/src/index.ts` | Public Apple API (`createAppleAccounts`: anisette, sign-in + 2FA, app tokens, saved accounts) |
| `apps/desktop/scripts/apple-probe.ts` | Maintainer CLI: sign in with real Apple IDs |
| `catalog/sources.json` | What can be installed and where releases come from (fetched by the app from `main`) |
| `packages/catalog/src/index.ts` | Public catalog API (`createCatalog`: manifest, release resolution with mirrors, verified downloads) |
| `apps/desktop/src/main/index.ts` | Electron main: wires Node adapters into the Engine (Phase 9) |
| `packages/ui/src/app/root.tsx` | UI root: router, providers, theme, i18n |
| `pnpm-workspace.yaml` / `turbo.json` | Workspace and task graph |
| `packages/kernel/src/index.ts` | LoadstarError/ErrorCode, ports, logger, byte utilities |
| `scripts/check-boundaries.ts` | Architecture dependency-rule checker |
| `.github/workflows/ci.yml` | Lint, typecheck, boundaries and tests on Linux, Windows and macOS |

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


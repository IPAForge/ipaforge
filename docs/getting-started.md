[Back to README](../README.md) · [Architecture →](architecture.md)

# Getting Started

## Current status

Loadstar is **pre-alpha**. Phase 0 (Foundation) and the Phase 1 signer are implemented. Phase 1 closes once CI has run on GitHub and the real-certificate check is done. There is no installable build yet.

| Area | State |
|---|---|
| Architecture and roadmap | Done (`docs/design/`) |
| Workspace, `@loadstar/kernel`, boundary checker, CI | Done (Phase 0) |
| Code signer (`@loadstar/signer`) | Implemented and verified against Apple `codesign` |
| Device, Apple, UI, apps | Planned |

## What you'll need (once released)

| Platform | Requirement |
|---|---|
| Windows | Apple Mobile Device support (installed with iTunes or Apple Devices) |
| macOS | Nothing extra; usbmuxd is built in |
| Linux | `usbmuxd` from your package manager |
| Web | A Chromium browser (Chrome, Edge, Brave) with WebUSB. Device access limits per OS are being evaluated in Phase 2 |
| All | An Apple ID (a free account works), an iPhone or iPad, and a USB cable |

On iOS 16 and later, **Developer Mode** must be on to run sideloaded apps. Onboarding will guide you through it.

## Development setup

Prerequisites: **Node 22+** (`.nvmrc`) and **pnpm**. Any pnpm 10+ switches automatically to the pinned version (12.11.2).

```bash
pnpm install
pnpm lint               # Biome: formatting + lint, including the platform-free import ban
pnpm typecheck          # tsc for every package and the scripts
pnpm check:boundaries   # architecture dependency rules
pnpm test               # Vitest across all packages
pnpm test:coverage      # same, with v8 coverage
```

CI runs the same commands on Ubuntu, Windows and macOS (`.github/workflows/ci.yml`).

Opt-in test suites:

| Variable | Runs |
|---|---|
| `LOADSTAR_E2E=1` | Real SideStore IPA end to end (downloads ~28 MB once into `.cache/`, SHA-256 pinned) |
| `LOADSTAR_BROWSER=1` | Browser parity in Chromium via Playwright (`pnpm exec playwright install chromium` first) |
| `LOADSTAR_BENCH=1` | Hashing throughput and IPA streaming benchmarks |

Apple-verification tests run automatically on macOS. Regenerating the signer fixtures requires macOS with Xcode (`fixtures/signer/generate.sh`).

## See Also

- [Roadmap](roadmap.md): what gets built in which phase
- [Contributing](contributing.md): workflow and conventions

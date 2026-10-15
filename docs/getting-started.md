[Back to README](../README.md) · [Architecture →](architecture.md)

# Getting Started

## Current status

Loadstar is **pre-alpha**. Phase 0 (Foundation) and Phase 1 (Signer) are complete, and Phase 2 (Device layer) is implemented. There is no installable build yet.

| Area | State |
|---|---|
| Architecture and roadmap | Done (`docs/design/`) |
| Workspace, `@loadstar/kernel`, boundary checker, CI | Done (Phase 0) |
| Code signer (`@loadstar/signer`) | Done (Phase 1): matches Apple `codesign`, verified with a real Apple Development certificate |
| Device layer (`@loadstar/device`, `apps/desktop` adapters) | Implemented (Phase 2): tested against a fake device and read-only on a real iPhone |
| Apple account (`@loadstar/apple`) | Implemented (Phase 3): sign-in, device 2FA and developer token verified with a real account |
| Developer services, UI, desktop app | Planned |

## What you'll need (once released)

| Platform | Requirement |
|---|---|
| Windows | Apple Mobile Device support (installed with iTunes or Apple Devices) |
| macOS | Nothing extra; usbmuxd is built in |
| Linux | `usbmuxd` from your package manager |
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
| `LOADSTAR_DEVICE=1` | Real-device suite (a trusted iPhone/iPad; read-only unless `LOADSTAR_DEVICE_WRITE=1`) |
| `LOADSTAR_BENCH=1` | Hashing throughput and IPA streaming benchmarks |

Apple-verification tests run automatically on macOS. Regenerating the signer fixtures requires macOS with Xcode (`fixtures/signer/generate.sh`).

## See Also

- [Roadmap](roadmap.md): what gets built in which phase
- [Contributing](contributing.md): workflow and conventions

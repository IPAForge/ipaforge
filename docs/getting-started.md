[← Installing](installing.md) · [Back to README](../README.md) · [Architecture →](architecture.md)

# Getting Started

## Current status

Loadstar is **pre-alpha**. Phases 0–5 are complete: foundation, signer, device layer, Apple account, developer services and the installer. Phase 6 (UI) is in progress: everything up to the log viewer is in; screenshot and accessibility tests are next. There is no installable build yet; see [Installing](installing.md) for how it will work.

| Area | State |
|---|---|
| Architecture and roadmap | Done (`docs/design/`) |
| Workspace, `@loadstar/kernel`, boundary checker, CI | Done (Phase 0) |
| Code signer (`@loadstar/signer`) | Done (Phase 1): matches Apple `codesign`, verified with a real Apple Development certificate |
| Device layer (`@loadstar/device`, `apps/desktop` adapters) | Implemented (Phase 2): tested against a fake device and read-only on a real iPhone |
| Apple account (`@loadstar/apple`) | Implemented (Phase 3): sign-in, device 2FA and developer token verified with a real account |
| Developer services (`apple.developer`) | Implemented (Phase 4): reads verified with a real account |
| Installer (`@loadstar/installer`) | Implemented (Phase 5): pipelines, catalog, install flows, IPA checks against the device, free-app limit, diagnostics and the Engine facade |
| Engine RPC (`@loadstar/rpc`) | Implemented (Phase 5): typed, validated Engine ⇄ UI messages; wired in Electron over a `MessageChannelMain` (`apps/desktop/src/main/rpc/serve-engine.ts`) |
| UI (`@loadstar/ui`) | In progress (Phase 6): palettes, the shell, routes, translations, accounts and sign-in, devices, the install run with its questions, step details and recovery screens, the log viewer |
| Desktop app (`apps/desktop`) | The Electron shell renders the UI connected to the real Engine; packaging comes in Phase 9 |

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
pnpm lint               # Biome (formatting + lint, including the platform-free import ban) + ESLint (blank lines, SonarJS, file structure)
pnpm typecheck          # tsc for every package and the scripts
pnpm check:boundaries   # architecture dependency rules
pnpm check:locales      # UI translations: keys, ICU, placeholders, completion
pnpm test               # Vitest across all packages
pnpm test:coverage      # same, with v8 coverage
```

CI runs the same commands on Ubuntu, Windows and macOS (`.github/workflows/ci.yml`), and builds the desktop app on all three.

### Running the app

```bash
pnpm --filter @loadstar/desktop dev      # the app in Electron, with hot reload
pnpm --filter @loadstar/desktop build    # main, preload and renderer into apps/desktop/out
pnpm --filter @loadstar/desktop preview  # build, then launch the built app
pnpm --filter @loadstar/ui dev           # the UI alone in a browser, http://localhost:5180
```

Electron downloads its binary (about 100 MB) the first time `dev` or `preview` runs, not during `pnpm install`; `pnpm --filter @loadstar/desktop ensure-electron` does the download on its own. See [The User Interface](ui.md).

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

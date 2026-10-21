[← Installing](installing.md) · [Back to README](../README.md) · [Architecture →](architecture.md)

# Getting Started

## Current status

IPAForge is in **alpha**: test builds are on the [Releases page](https://github.com/IPAForge/ipaforge/releases). Phases 0–6 are complete: foundation, signer, device layer, Apple account, developer services, the installer and the UI foundation. Phase 8 (install and preload) is complete too: Preload with app sources, the Apps page with refresh, Repair SideStore, SideStore QR codes and the on-device checklist. Phase 9 (the desktop app) is complete too: installers for every system, Sigstore-signed releases, and updates itself; Windows code signing and Apple notarisation come with 1.0. Onboarding (Phase 7) comes next. See [Installing](installing.md) to try a build.

| Area | State |
|---|---|
| Architecture and roadmap | Done (`docs/design/`) |
| Workspace, `@ipaforge/kernel`, boundary checker, CI | Done (Phase 0) |
| Code signer (`@ipaforge/signer`) | Done (Phase 1): matches Apple `codesign`, verified with a real Apple Development certificate |
| Device layer (`@ipaforge/device`, `apps/desktop` adapters) | Implemented (Phase 2): tested against a fake device and read-only on a real iPhone |
| Apple account (`@ipaforge/apple`) | Implemented (Phase 3): sign-in, device 2FA and developer token verified with a real account |
| Developer services (`apple.developer`) | Implemented (Phase 4): reads verified with a real account |
| Installer (`@ipaforge/installer`) | Implemented (Phase 5): pipelines, catalog, install flows, IPA checks against the device, free-app limit, diagnostics and the Engine facade |
| Engine RPC (`@ipaforge/rpc`) | Implemented (Phase 5): typed, validated Engine ⇄ UI messages; wired in Electron over a `MessageChannelMain` (`apps/desktop/src/main/rpc/serve-engine.ts`) |
| UI (`@ipaforge/ui`) | Done (Phases 6 and 8): palettes, the shell, routes, translations, accounts and sign-in, devices and their checklist, the install run with its questions, step details and recovery screens, Preload and app sources, Apps, Repair SideStore, the log viewer, the update screen and What's new, layout and accessibility tests |
| Desktop app (`apps/desktop`) | Done (Phase 9): installers for macOS, Windows and Linux built and Sigstore-signed by CI; updates itself, checking each update's signature |

## What you'll need

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
pnpm test:browser       # UI layout, accessibility and keyboard in a real Chromium (see User Interface)
```

CI runs the same commands on Ubuntu, Windows and macOS (`.github/workflows/ci.yml`), and builds the desktop app on all three. The browser tests run on Linux, in Playwright's Docker image; `pnpm exec playwright install chromium` gets the browser for running them locally.

### Running the app

```bash
pnpm --filter @ipaforge/desktop dev      # the app in Electron, with hot reload
pnpm --filter @ipaforge/desktop build    # main, preload and renderer into apps/desktop/out
pnpm --filter @ipaforge/desktop preview  # build, then launch the built app
pnpm --filter @ipaforge/desktop dist     # installers for this system into apps/desktop/release (electron-builder)
pnpm --filter @ipaforge/ui dev           # the UI alone in a browser, http://localhost:5180
```

Electron downloads its binary (about 100 MB) the first time `dev` or `preview` runs, not during `pnpm install`; `pnpm --filter @ipaforge/desktop ensure-electron` does the download on its own. See [The User Interface](ui.md).

Opt-in test suites:

| Variable | Runs |
|---|---|
| `IPAFORGE_E2E=1` | Real SideStore IPA end to end (downloads ~28 MB once into `.cache/`, SHA-256 pinned) |
| `IPAFORGE_DEVICE=1` | Real-device suite (a trusted iPhone/iPad; read-only unless `IPAFORGE_DEVICE_WRITE=1`) |
| `IPAFORGE_BENCH=1` | Hashing throughput and IPA streaming benchmarks |

Apple-verification tests run automatically on macOS. Regenerating the signer fixtures requires macOS with Xcode (`fixtures/signer/generate.sh`).

## See Also

- [Roadmap](roadmap.md): what gets built in which phase
- [Contributing](contributing.md): workflow and conventions

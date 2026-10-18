# Loadstar

[![CI](https://github.com/SirReaDy/loadstar/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SirReaDy/loadstar/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/github/downloads/SirReaDy/loadstar/total?label=downloads)](https://github.com/SirReaDy/loadstar/releases)
[![Latest release](https://img.shields.io/github/v/release/SirReaDy/loadstar?include_prereleases&label=release)](https://github.com/SirReaDy/loadstar/releases/latest)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Sponsor](https://img.shields.io/badge/sponsor-%E2%9D%A4-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/SirReaDy)

> Install SideStore and preload your apps onto iPhone and iPad, from Windows, macOS or Linux.

Loadstar is an open-source desktop app for installing [SideStore](https://github.com/SideStore/SideStore) and other apps on iOS devices. It signs in to your Apple ID and gets a free development certificate. It re-signs each app and installs it over USB. It also places the pairing file and certificate SideStore needs to refresh apps on its own. Extra apps can be preloaded in the same run.

The engine is written entirely in TypeScript, with no native helpers or bundled command-line tools. The desktop app is built with Electron.

> [!NOTE]
> **Pre-alpha.** The engine is complete, and the desktop app is in active development. There is no packaged release yet. See [Project status](#project-status) and the [Roadmap](docs/roadmap.md).

## Why Loadstar

Sideloading tools tend to fail in a few recurring ways. Loadstar is designed around each of them:

| Common failure | How Loadstar handles it |
|---|---|
| Apple ID sign-in errors (`-80045`) | Anisette servers are health-checked and fall back automatically; macOS uses native anisette |
| `HTTP 404` when downloading SideStore or LiveContainer | Releases are resolved through the GitHub API from a catalog that can be updated remotely, never from hard-coded URLs |
| "Unable to verify app" after installing | The signer matches Apple `codesign` byte for byte, and each extension gets the entitlements from its own profile |
| Errors that don't say what to do | Every failure has a stable error code, a plain-language explanation and the fixes that apply |

## Features

- **One-click SideStore.** Install SideStore, or LiveContainer with SideStore, from the Stable or Nightly channel. The pairing file and signing certificate are placed automatically.
- **Clear install plan.** Before anything changes, Loadstar shows what the install uses: App IDs and how many are left this week, free-app slots on the device, whether the certificate is reused, and the team.
- **Live progress.** Every step reports what it did, for example the release it found, whether a saved session was reused, or how many App IDs it registered.
- **Recovery, not dead ends.** Failures lead to a screen with the fixes that apply, such as continuing from where the run stopped or switching Apple ID. Diagnostics can be copied, and an issue report opens pre-filled.
- **Multiple Apple IDs.** Saved in the system keychain, with free and paid teams, and a quick switch when one is blocked on a device.
- **Works within Apple's limits.** The App ID quota, the three-app limit for free accounts and certificate limits are checked before any change, and each is explained.
- **Your language.** The language follows the system, and right-to-left languages are supported. Six languages today, every language iOS supports by 1.0.
- **Themes.** Six colour palettes, each with light and dark variants.

Coming next: guided onboarding, a preload picker for your own IPAs, deep links and a QR code for SideStore sources, management tools for certificates and App IDs, and Wi-Fi installs.

## Project status

| Component | Package | Status |
|---|---|---|
| Code signing | `@loadstar/signer` | ✅ Complete: matches Apple `codesign` on golden fixtures, verified with a real Apple Development certificate |
| Device communication | `@loadstar/device` | ✅ Complete: usbmux, lockdown, pairing, AFC, house_arrest, installation_proxy, misagent |
| Apple account | `@loadstar/apple` | ✅ Complete: sign-in with two-factor authentication, anisette with fallback, saved accounts |
| Developer services | `@loadstar/apple` | ✅ Complete: teams, certificates, App IDs, app groups, devices, provisioning profiles |
| Release catalog | `@loadstar/catalog` | ✅ Complete: GitHub release resolution, mirrors, verified downloads, cache |
| Install engine | `@loadstar/installer` | ✅ Complete: resumable pipelines, install flows, free-app limit, error catalogue |
| Engine ⇄ UI protocol | `@loadstar/rpc` | ✅ Complete: typed, validated messages over Electron IPC |
| User interface | `@loadstar/ui` | 🚧 In progress: accounts, devices, the install run with its questions, step details and recovery are built; the log viewer is next |
| Desktop app | `apps/desktop` | 🚧 In progress: the hardened Electron shell runs against the real engine; packaging and auto-update are planned |

Sideload signing has been verified against real devices and Apple accounts. Apple's own `codesign --verify --deep --strict` accepts the output, including a full SideStore build signed in about half a second. Details: [Code Signing](docs/signing.md).

## Requirements

| Platform | What you need |
|---|---|
| Windows 10/11 | Apple Devices (Microsoft Store) or iTunes, which provides the Apple Mobile Device Service |
| macOS | Nothing extra |
| Linux | `usbmuxd` from your package manager |

You also need an Apple ID (a free account works), an iPhone or iPad on iOS 15 or later with a passcode, and a USB cable that carries data. On iOS 16 and later, Developer Mode must be on. See [Installing](docs/installing.md).

## Building from source

Prerequisites: Node.js 22 or later and pnpm.

```bash
pnpm install
pnpm --filter @loadstar/desktop dev   # run the desktop app with hot reload
pnpm --filter @loadstar/ui dev        # run the UI in a browser against a simulated engine
pnpm verify                           # lint, type checks, architecture rules, translations and tests
```

[Getting Started](docs/getting-started.md) covers every command, the optional test suites that use real devices, and the maintainer tools.

## Architecture

Loadstar uses ports and adapters, with one package per area:

```
kernel  ←  signer, device, apple, catalog  ←  installer  ←  rpc  ←  ui
                                     apps/desktop wires the adapters and mounts the UI
```

The core packages are platform-independent: they never import Node.js, Electron or browser APIs, and CI enforces this. Everything specific to an operating system lives in `apps/desktop`. So the engine can be tested without a phone or an Apple account, and every platform difference stays in one place. Read more in [Architecture](docs/architecture.md).

| Layer | Technology |
|---|---|
| Engine | TypeScript 7 (strict, ESM), WebCrypto, pkijs, zod |
| Interface | React 19, HeroUI v3, Tailwind CSS v4, TanStack Router and Query, i18next with ICU messages |
| Desktop | Electron 44, electron-vite |
| Quality | Vitest, Biome, ESLint, CI on Linux, Windows and macOS |

## Scope

**In scope**

- Installing SideStore, or LiveContainer with SideStore, with its pairing file and certificate, so it can refresh apps on the device
- Preloading extra IPAs (files or URLs) in the same run, and setting up SideStore sources
- Guided onboarding: drivers, device trust, Developer Mode, Apple ID with two-factor authentication, team selection
- Managing what a free or paid Apple developer account provides: certificates, App IDs, profiles, pairing files

**Out of scope**

- Decrypting App Store apps or obtaining IPAs. Loadstar signs only apps you already have, and refuses FairPlay-encrypted binaries.
- Jailbreaking, or working around Apple's account limits (App ID quota, certificate count, 7-day free profiles). Loadstar works within these limits and explains them.
- A web or browser version, and distributing apps to other people's devices.
- tvOS, standalone watchOS and macOS apps. Watch extensions inside iOS apps are supported.

## Documentation

| Guide | Description |
|---|---|
| [Installing](docs/installing.md) | Download, system requirements, first run |
| [Getting Started](docs/getting-started.md) | Current status, development setup, test suites |
| [Architecture](docs/architecture.md) | Packages, ports and adapters, dependency rules |
| [Code Signing](docs/signing.md) | How iOS code signing works and how Loadstar verifies it |
| [Device](docs/device.md) | Reaching iPhone and iPad, pairing, device errors |
| [Apple Account](docs/apple-account.md) | Apple ID sign-in, two-factor authentication, saved accounts, sign-in errors |
| [Install Flows](docs/install-flows.md) | Install steps, questions, step details, the free-app limit, recovery |
| [Engine RPC](docs/rpc.md) | How the interface talks to the engine |
| [User Interface](docs/ui.md) | Running the UI, structure, themes, translations, styling rules |
| [Roadmap](docs/roadmap.md) | Phases from foundation to 1.0 |
| [Contributing](docs/contributing.md) | Pull request rules and conventions |

## Contributing

Contributions are welcome. Read [Contributing](docs/contributing.md) first. All changes reach `main` through reviewed pull requests, and CI must pass on Linux, Windows and macOS. Please follow the [Code of Conduct](docs/CODE_OF_CONDUCT.md).

## Security

Please don't report vulnerabilities in public issues. Follow the private process in the [Security Policy](docs/SECURITY.md). Never post your Apple ID password, verification codes, pairing files, certificates or device UDID in an issue.

## Acknowledgements

Loadstar is an independent, clean-room implementation. It relies on public protocol knowledge documented by [libimobiledevice](https://libimobiledevice.org), [SideStore](https://github.com/SideStore/SideStore), [rcodesign](https://github.com/indygreg/apple-platform-rs) and [zsign](https://github.com/zhlynn/zsign). It contains no code copied from other sideloading tools, or from GPL, AGPL or proprietary projects.

Loadstar is not affiliated with or endorsed by Apple Inc. iPhone, iPad and iOS are trademarks of Apple Inc.

## Sponsor

Loadstar is free and open source, maintained in spare time. If it saves you time, consider [sponsoring the project](https://github.com/sponsors/SirReaDy). Sponsorship pays for code-signing certificates (Windows signing, Apple notarisation), test devices, and maintenance when Apple changes something.

## Licence

[MIT](LICENSE) © 2026 Dan Motpan and Loadstar contributors. Third-party components keep their own licences: pkijs, asn1js and zip.js are BSD-3-Clause; @noble/hashes and zod are MIT.

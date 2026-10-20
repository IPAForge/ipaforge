# IPAForge

[![CI](https://github.com/SirReaDy/ipaforge/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SirReaDy/ipaforge/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/github/downloads/SirReaDy/ipaforge/total?label=downloads)](https://github.com/SirReaDy/ipaforge/releases)
[![Latest release](https://img.shields.io/github/v/release/SirReaDy/ipaforge?include_prereleases&label=release)](https://github.com/SirReaDy/ipaforge/releases/latest)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Sponsor](https://img.shields.io/badge/sponsor-%E2%9D%A4-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/SirReaDy)

> Install SideStore and preload your apps onto iPhone and iPad, from Windows, macOS or Linux.

IPAForge is an open-source desktop app for installing [SideStore](https://github.com/SideStore/SideStore) and other apps on iOS devices. It signs in to your Apple ID and gets a free development certificate. It re-signs each app and installs it over USB. It also places the pairing file and certificate SideStore needs to refresh apps on its own. Extra apps can be preloaded in the same run.

The engine is written entirely in TypeScript, with no native helpers or bundled command-line tools. The desktop app is built with Electron.

> [!NOTE]
> **Alpha.** The engine is complete, and the first test builds for macOS, Windows and Linux are on the [Releases page](https://github.com/SirReaDy/ipaforge/releases) (not notarised yet; [how to open them the first time](docs/installing.md#opening-ipaforge-the-first-time)). See [Project status](#project-status) and the [Roadmap](docs/roadmap.md).

## Why IPAForge

Sideloading tools tend to fail in a few recurring ways. IPAForge is designed around each of them:

| Common failure | How IPAForge handles it |
|---|---|
| Apple ID sign-in errors (`-80045`) | Anisette servers are health-checked and fall back automatically; macOS uses native anisette |
| `HTTP 404` when downloading SideStore or LiveContainer | Releases are resolved through the GitHub API from a catalog that can be updated remotely, never from hard-coded URLs |
| "Unable to verify app" after installing | The signer matches Apple `codesign` byte for byte, and each extension gets the entitlements from its own profile |
| Errors that don't say what to do | Every failure has a stable error code, a plain-language explanation and the fixes that apply |

## Features

- **One-click SideStore.** Install SideStore, or LiveContainer with SideStore, from the Stable or Nightly channel. The pairing file and signing certificate are placed automatically.
- **Keep apps working.** The Apps page lists what IPAForge installed, with when each app expires, and refreshes them (signed again, data kept) with one press or by itself before they expire. It updates them from their source too.
- **Preload apps.** Drop .ipa files, choose them, add a link, or browse apps from the catalog (LiveContainer, StikDebug, Feather…), SideStore's source and any AltStore-format source you add. Each app is checked before anything changes: its version, the App IDs it needs, whether the device can run it, and whether it updates one already installed. Then they install in one run.
- **Repair SideStore.** IPAForge checks, line by line, what keeps SideStore from refreshing your apps by itself (who signed it, its certificate, its pairing file, when it expires) and fixes it in one go.
- **SideStore links and QR codes.** Add a source to SideStore on the iPhone, or have SideStore install an app, by scanning a code.
- **A checklist for each device.** What it needs for its iOS version (Trust, a passcode, Developer Mode, trusting your Apple ID, LocalDevVPN for SideStore), ticked as you go.
- **Clear install plan.** Before anything changes, IPAForge shows what the install uses: App IDs and how many are left this week, free-app slots on the device, whether the certificate is reused, and the team.
- **Live progress.** Every step reports what it did, for example the release it found, whether a saved session was reused, or how many App IDs it registered.
- **Recovery, not dead ends.** Failures lead to a screen with the fixes that apply, such as continuing from where the run stopped or switching Apple ID. Diagnostics can be copied, and an issue report opens pre-filled.
- **Multiple Apple IDs.** Saved in the system keychain, with free and paid teams, and a quick switch when one is blocked on a device.
- **Works within Apple's limits.** The App ID quota, the three-app limit for free accounts and certificate limits are checked before any change, and each is explained.
- **Your language.** The language follows the system, and right-to-left languages are supported. Six languages today, every language iOS supports by 1.0.
- **Themes.** Six colour palettes, each with light and dark variants.
- **Updates itself.** IPAForge checks for a new version when it opens and installs it, each update checked against its release's Sigstore signature first. **What's new** says what changed, in plain words.

Coming next: guided onboarding, management tools for certificates and App IDs, and Wi-Fi installs.

## Project status

| Component | Package | Status |
|---|---|---|
| Code signing | `@ipaforge/signer` | ✅ Complete: matches Apple `codesign` on golden fixtures, verified with a real Apple Development certificate |
| Device communication | `@ipaforge/device` | ✅ Complete: usbmux, lockdown, pairing, AFC, house_arrest, installation_proxy, misagent |
| Apple account | `@ipaforge/apple` | ✅ Complete: sign-in with two-factor authentication, anisette with fallback, saved accounts |
| Developer services | `@ipaforge/apple` | ✅ Complete: teams, certificates, App IDs, app groups, devices, provisioning profiles |
| Release catalog | `@ipaforge/catalog` | ✅ Complete: GitHub release resolution, mirrors, verified downloads, cache, AltStore-format app sources |
| Install engine | `@ipaforge/installer` | ✅ Complete: resumable pipelines, install flows, free-app limit, error catalogue |
| Engine ⇄ UI protocol | `@ipaforge/rpc` | ✅ Complete: typed, validated messages over Electron IPC, and the update channel |
| User interface | `@ipaforge/ui` | ✅ Install and preload complete: accounts, devices with their checklist, the install run with its questions, step details and recovery, Preload with app sources, Apps with refresh, Repair SideStore, the log viewer, and What's new, in six languages, checked by screenshot and WCAG 2.2 AA tests; onboarding comes next |
| Desktop app | `apps/desktop` | 🚧 Alpha: installers for macOS (DMG, zip), Windows (NSIS, MSI) and Linux (AppImage, deb, rpm), built, Sigstore-signed and published by CI on a version tag; updates itself, checking each update's signature; Windows code signing and Apple notarisation are planned |

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
pnpm --filter @ipaforge/desktop dev   # run the desktop app with hot reload
pnpm --filter @ipaforge/ui dev        # run the UI in a browser against a simulated engine
pnpm verify                           # lint, type checks, architecture rules, translations and tests
```

[Getting Started](docs/getting-started.md) covers every command, the optional test suites that use real devices, and the maintainer tools.

## Architecture

IPAForge uses ports and adapters, with one package per area:

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

- Decrypting App Store apps or obtaining IPAs. IPAForge signs only apps you already have, and refuses FairPlay-encrypted binaries.
- Jailbreaking, or working around Apple's account limits (App ID quota, certificate count, 7-day free profiles). IPAForge works within these limits and explains them.
- A web or browser version, and distributing apps to other people's devices.
- tvOS, standalone watchOS and macOS apps. Watch extensions inside iOS apps are supported.

## Documentation

| Guide | Description |
|---|---|
| [Installing](docs/installing.md) | Download, system requirements, first run |
| [Getting Started](docs/getting-started.md) | Current status, development setup, test suites |
| [Architecture](docs/architecture.md) | Packages, ports and adapters, dependency rules |
| [Code Signing](docs/signing.md) | How iOS code signing works and how IPAForge verifies it |
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

IPAForge is an independent, clean-room implementation. It relies on public protocol knowledge documented by [libimobiledevice](https://libimobiledevice.org), [SideStore](https://github.com/SideStore/SideStore), [rcodesign](https://github.com/indygreg/apple-platform-rs) and [zsign](https://github.com/zhlynn/zsign). It contains no code copied from other sideloading tools, or from GPL, AGPL or proprietary projects.

IPAForge is not affiliated with or endorsed by Apple Inc. iPhone, iPad and iOS are trademarks of Apple Inc.

## Sponsor

IPAForge is free and open source, maintained in spare time. If it saves you time, consider [sponsoring the project](https://github.com/sponsors/SirReaDy). Sponsorship pays for code-signing certificates (Windows signing, Apple notarisation), test devices, and maintenance when Apple changes something.

## Licence

[MIT](LICENSE) © 2026 Dan Motpan and IPAForge contributors. Third-party components keep their own licences: pkijs, asn1js and zip.js are BSD-3-Clause; @noble/hashes and zod are MIT.

# IPAForge

[![CI](https://github.com/IPAForge/ipaforge/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/IPAForge/ipaforge/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/github/downloads/IPAForge/ipaforge/total?label=downloads)](https://github.com/IPAForge/ipaforge/releases)
[![Latest release](https://img.shields.io/github/v/release/IPAForge/ipaforge?include_prereleases&label=release)](https://github.com/IPAForge/ipaforge/releases/latest)
[![Licence: AGPL-3.0](https://img.shields.io/badge/licence-AGPL--3.0-blue.svg)](LICENSE)
[![Sponsor](https://img.shields.io/badge/sponsor-%E2%9D%A4-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/SirReaDy)

**Install SideStore and your own apps on iPhone and iPad with a free Apple ID, from Windows, macOS or Linux.**

**[Website](https://ipaforge.com)** · **[Download](https://github.com/IPAForge/ipaforge/releases)** · **[Discord](https://discord.gg/C87DKmAWhr)** · [Installing](docs/installing.md) · [Roadmap](docs/roadmap.md)

IPAForge is a free, open-source desktop app for sideloading. You plug in your iPhone, sign in with your Apple ID, and it does the rest:

1. It gets a free development certificate from Apple for your Apple ID.
2. It signs [SideStore](https://github.com/SideStore/SideStore) (or LiveContainer with SideStore, or any `.ipa` you choose) with that certificate.
3. It installs the apps on your device, and places the pairing file and certificate SideStore needs to refresh apps by itself.

After that it keeps them working: it shows when each app expires, refreshes them before they do, repairs SideStore when it stops refreshing, and explains every failure with the fixes that apply. The whole engine, code signing included, is written in TypeScript, with no native helpers or bundled command-line tools.

> [!NOTE]
> **Alpha, 0.1.0-alpha.5.** Builds for macOS, Windows and Linux are on the [Releases page](https://github.com/IPAForge/ipaforge/releases), and IPAForge updates itself from there. It isn't notarised or code-signed for Windows yet: [how to open it the first time](docs/installing.md#opening-ipaforge-the-first-time). Questions and feedback: [Discord](https://discord.gg/C87DKmAWhr) or [Issues](https://github.com/IPAForge/ipaforge/issues).

## Why IPAForge

Sideloading tools tend to fail in a few recurring ways. IPAForge is designed around each of them:

| Common failure | How IPAForge handles it |
|---|---|
| Apple ID sign-in errors (`-80045`) | Anisette servers come from SideStore's up-to-date list and fall back automatically, or you choose or add your own in Settings |
| `HTTP 404` when downloading SideStore or LiveContainer | Releases are resolved through the GitHub API from a catalog that can be updated remotely, never from hard-coded URLs |
| "Unable to verify app" after installing | The signer matches Apple `codesign` byte for byte, and each extension gets the entitlements from its own profile |
| Errors that don't say what to do | Every failure has a stable error code, a plain-language explanation and the fixes that apply |

## Features

- **One-click SideStore.** SideStore, or LiveContainer with SideStore, Stable or Nightly. The pairing file and certificate are placed for you.
- **Preload your apps.** Drop .ipa files, paste a link, or browse the catalog, SideStore's source and any AltStore-format source you add. Each app is checked before anything changes, then they all install in one run.
- **Apps that don't expire.** See when each app expires. Refresh works like SideStore's: a new profile while your certificate is valid, nothing reinstalled. IPAForge can refresh them by itself before they expire.
- **Repair SideStore.** Checks what keeps SideStore from refreshing by itself, line by line, and fixes it in one go.
- **QR codes for SideStore.** Add a source to SideStore on your iPhone, or have SideStore install an app, by scanning a code.
- **A checklist for each iPhone.** Trust, passcode, Developer Mode, trusting your Apple ID, LocalDevVPN: what your iOS version needs, ticked as you go.
- **Recovery, not dead ends.** Every failure has a screen with the fixes that apply, copyable diagnostics and a pre-filled bug report.
- **Live progress.** Every step shows what it's doing: speed and time left while sending the app, Apple's steps, and iOS's own install progress, over USB or Wi-Fi.
- **Logs you can share.** Every step IPAForge took, with search and filters, saved to a file to attach to a bug report.
- **Several Apple IDs.** Two-factor sign-in with a code on your devices or by text. Kept in your system keychain, free and paid teams, with a quick switch when Apple blocks one on a device.
- **Anisette servers your way.** IPAForge picks a working server by itself from SideStore's list, with its own servers as a backup. Or choose one, add your own (a server on your computer included), and test each one.
- **Works within Apple's limits.** The App ID quota, the three-app limit for free accounts and certificate limits are checked before any change, and each is explained.
- **Updates itself.** A new version installs when IPAForge opens, after its release signature checks out, and What's new tells you what changed.
- **Your language, your look.** Six languages, right to left included, and six colour themes in light and dark.

Sideload signing has been verified against real devices and Apple accounts: Apple's own `codesign --verify --deep --strict` accepts the output, including a full SideStore build signed in about half a second. Details: [Code Signing](docs/signing.md).

New: the **Developer Portal** page, with your team's certificates (and the apps each one signs), App IDs, the profiles on your device, app groups and registered devices, and the iOS 17+ remote pairing file for SideStore. Pairing files per app: place, remove or give your own apps one, in one dialog. Save signed `.ipa` files instead of installing them. Coming next: `.p12` import and export, and guided onboarding. Installing over Wi-Fi to a device paired before already works.

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

[GNU Affero General Public License v3.0 or later](LICENSE) (AGPL-3.0-or-later) © 2026 Dan Motpan and IPAForge contributors. You may use, study, change and share IPAForge; anything built from it, including a modified version offered over a network, must be released under the same licence with its source. Versions up to 0.1.0-alpha.4 were released under the MIT licence. Third-party components keep their own licences: pkijs, asn1js and zip.js are BSD-3-Clause; @noble/hashes and zod are MIT.

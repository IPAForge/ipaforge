# Loadstar

[![CI](https://github.com/SirReaDy/loadstar/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SirReaDy/loadstar/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/github/downloads/SirReaDy/loadstar/total?label=downloads)](https://github.com/SirReaDy/loadstar/releases)
[![Latest release](https://img.shields.io/github/v/release/SirReaDy/loadstar?include_prereleases&label=release)](https://github.com/SirReaDy/loadstar/releases/latest)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Sponsor](https://img.shields.io/badge/sponsor-%E2%9D%A4-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/SirReaDy)

> Install SideStore and preload your apps onto iPhone and iPad, from Windows, macOS or Linux.

Loadstar signs into your Apple ID, gets a free development certificate, re-signs apps, installs them over USB, and sets up SideStore so it can refresh itself. It also preloads any extra apps you choose in the same run. The whole engine is TypeScript, and the app is a desktop app built with Electron.

> **Status: pre-alpha.** The signing engine, the device layer, Apple ID sign-in, developer services, the install flows and the Engine RPC are built. The desktop app is in progress: it connects to the Engine, signs in Apple IDs, shows devices and runs the SideStore install with its questions. There is no packaged release yet. See the [Roadmap](docs/roadmap.md).

## Design goals

Sideloading installers usually fail in a few recurring ways. Loadstar is designed around each one:

| Common failure | Loadstar's approach |
|---|---|
| Apple ID login errors (`-80045`) | Health-checked anisette servers with automatic fallback, plus native anisette on macOS |
| `HTTP 404` when downloading SideStore / LiveContainer | Releases resolved through the GitHub API from a configurable catalog, never from hardcoded URLs |
| "Verification failed" installs | A signer verified byte for byte against Apple `codesign`, with entitlements taken from each extension's own profile |
| Cryptic error messages | Every failure has an error code with a plain-language recovery screen |

## Key Features (planned)

- **Guided onboarding.** Checks drivers, connects and trusts your device, enables Developer Mode, and walks through Apple ID sign-in with 2FA.
- **One-click SideStore.** Stable or nightly, with the pairing file placed automatically.
- **Preload apps.** Add IPAs from files or URLs and install them all in one session.
- **Device and account tools.** Manage certificates, app IDs and pairing files, with import and export.
- **Themes.** Several colour palettes, each with light and dark variants.
- **Your language.** Every language iOS supports, right-to-left included, picked automatically from your system.
- **Desktop.** One Electron app for Windows, macOS and Linux.

## Scope

**In scope**

- Installing **SideStore** (and LiveContainer + SideStore) with its pairing file, so it can refresh apps on-device afterwards
- **Preloading** additional IPAs (files or URLs) in the same session, and pre-configuring SideStore sources
- Guided **onboarding**: drivers, device trust, Developer Mode, Apple ID with 2FA, team selection
- Managing what a free or paid **Apple developer account** provides: certificates, app IDs, profiles, pairing files
- **Desktop** app for Windows, macOS and Linux

**Out of scope**

- Decrypting App Store apps or obtaining IPAs. Loadstar only signs apps you already have, and refuses FairPlay-encrypted binaries
- Jailbreaking, or working around Apple's account limits (app-ID quota, certificate count, 7-day free profiles). Loadstar works within them and explains them
- A web or browser version
- Distributing apps to other people's devices
- tvOS, watchOS-only and macOS apps (Watch extensions inside iOS apps are handled)

## How it's built

| Layer | Tech |
|---|---|
| Engine | TypeScript packages: `signer`, `device`, `apple`, `catalog`, `installer` (ports & adapters) |
| UI | React 19, HeroUI v3, Tailwind CSS v4 (no hand-written CSS) |
| Desktop | Electron 44 |

The signer (`@loadstar/signer`) is done. Its output is **byte-identical to Apple `codesign`** on the golden fixtures, Apple's own `codesign --verify --deep --strict` accepts sideload-signed apps (real SideStore included, signed in about 0.5 s). Details: [Code signing](docs/signing.md).

## Documentation

| Guide | Description |
|---|---|
| [Installing](docs/installing.md) | Download, requirements per system, first run |
| [Getting Started](docs/getting-started.md) | Current status, requirements, how to follow along |
| [Architecture](docs/architecture.md) | Packages, ports & adapters, dependency rules |
| [Code Signing](docs/signing.md) | How iOS signing works and how Loadstar verifies it |
| [Device](docs/device.md) | How Loadstar reaches iPhones and iPads, pairing, and device errors |
| [Apple Account](docs/apple-account.md) | Apple ID sign-in, 2FA, saved accounts, sign-in errors |
| [Install Flows](docs/install-flows.md) | Installing SideStore and apps: steps, prompts, free-app limit, recovery |
| [Engine RPC](docs/rpc.md) | How the UI talks to the Engine: messages, runs, errors |
| [User Interface](docs/ui.md) | The UI package: running it in a browser, folder structure, palettes and themes, the shell, styling rules |
| [Roadmap](docs/roadmap.md) | Phases from foundation to 1.0 |
| [Contributing](docs/contributing.md) | How to contribute, pull request rules, conventions |
| [Code of Conduct](docs/CODE_OF_CONDUCT.md) | How we treat each other |
| [Security Policy](docs/SECURITY.md) | Reporting vulnerabilities privately |

## Acknowledgements

Loadstar is an independent implementation. It uses public protocol knowledge from the [libimobiledevice](https://libimobiledevice.org) project, [SideStore](https://github.com/SideStore/SideStore), [rcodesign](https://github.com/indygreg/apple-platform-rs) and [zsign](https://github.com/zhlynn/zsign) as references. It is a clean-room implementation: it contains no code copied from other sideloading tools or from GPL/AGPL or proprietary projects.

## Contributing

Contributions are welcome: see [Contributing](docs/contributing.md). Changes reach `main` only through reviewed pull requests. Please follow the [Code of Conduct](docs/CODE_OF_CONDUCT.md), and report security issues privately as described in the [Security Policy](docs/SECURITY.md).

## Sponsor

Loadstar is free and open source, built in spare time. If it saves you time, consider [sponsoring the project on GitHub](https://github.com/sponsors/SirReaDy). Sponsorship pays for signing certificates (Windows code signing, Apple notarisation), test devices, and time for maintenance when Apple changes something.

## License

[MIT](LICENSE) © 2026 Dan Motpan and Loadstar contributors. Third-party components keep their own licences (pkijs, asn1js and zip.js: BSD-3-Clause; @noble/hashes and zod: MIT).

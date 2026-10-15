# Project Roadmap

> Open-source desktop SideStore installer for Windows, macOS and Linux, with app preloading, built on a pure-TypeScript engine that is verified against Apple `codesign`.

Each milestone is a **phase**. Phases are ordered by dependency. Phases 2 and 3 (device, Apple) can run in parallel.

## Product features (v1.0)

Every feature below maps to the phases that deliver it. "Automatic" means the user never has to do a step by hand that the engine can do or detect.

| Feature | Phases |
|---|---|
| The recommended way to install SideStore: one click, fully automatic | 5, 8 |
| Install SideStore or LiveContainer + SideStore, then import the signing certificate and the pairing file into it automatically | 2, 4, 5, 8 |
| Install any `.ipa` (files or URLs), several in one run (preload) | 5, 8 |
| Manage certificates and App IDs (list, revoke, delete, quota) | 4, 10 |
| Place pairing files into several apps (SideStore, LiveContainer, StikDebug and others from a data-driven app list) | 2, 5, 10 |
| Save and switch between multiple Apple IDs | 3, 10 |
| SideStore integration: sources via deep links/QR, anisette server choice, Wi-Fi refresh prerequisites | 5, 8, 11 |
| The app in every language iOS supports (about 40, right-to-left included), community-translated, picked automatically from the OS | 6, 7–9, 12 |
| Every known failure detected and handled: automatic retry or fix where possible, otherwise a recovery screen (catalogue built from real user reports: `references/failure-catalogue.md`) | all |

## Milestones

- [x] **0. Foundation**: pnpm + Turborepo monorepo, TS 7 strict config, Biome, Vitest, the `kernel` package (Result, `LoadstarError`/`ErrorCode`, ports, bytes utils), a boundary checker (no `node:*`/DOM in `packages/`), and GitHub Actions CI on Linux, Windows and macOS (macOS also runs `codesign`)
- [x] **1. Signer**: production `@loadstar/signer` built from the spike and the format spec:
  - binaries: thin and fat, adding `LC_CODE_SIGNATURE` when missing, 4K/16K pages, SHA-1 + SHA-256 dual CDs for minimum iOS below 11;
  - bundles: frameworks, dylibs and appexes signed inner-first, plus streaming IPA read and write;
  - bundle ID, entitlement and profile reconciliation;
  - golden Apple fixtures and checking the CMS against a real Apple Development certificate
- [x] **2. Device layer**: `@loadstar/device`:
  - usbmux client and lockdown;
  - pairing: read existing pair records and create new ones with a trust prompt;
  - services: TLS sessions, AFC, house_arrest, installation_proxy (install with progress, list apps), misagent (profiles on the device);
  - checks: Developer Mode and locked device. Node adapters are tested on real hardware
- [x] **3. Apple account**: `@loadstar/apple`:
  - anisette v3 client with a health-checked server chain and automatic fallback (native anisette on macOS), plus an opt-in **local anisette** provider: a Provision `anisette-server` sidecar that downloads Apple's libraries itself, so no third-party server is needed (RESEARCH.md §4; v1 protocol client done, sidecar process management moves to Phase 9);
  - GSA SRP-6a login, 2FA (trusted device and SMS, with non-fatal phone lookup), token refresh;
  - multiple Apple IDs: `SecretStore`-backed saved accounts with switch, sign-out and per-account team/certificate state;
  - Apple-facing client identity as remotely updatable data (from the anisette server's `client_info` or signed config), never constants;
  - a full 2FA state machine (device push, SMS number picker, resend, legacy 4-digit codes, server-provided code length, "code already sent" states, security-key explanation);
  - automatic recovery for every known login failure (`references/failure-catalogue.md`): anisette failover and re-provisioning, clock-skew and connectivity preflight, backoff on 429/503, no auto-retry on wrong passwords, account health and ban flags
- [x] **4. Developer services**: teams (team picker remembered per Apple ID), certificate lifecycle (reuse by machine name and key, a revoke picker showing which tool created each certificate, per-type revoke, `.p12` export/import with the `machineId` password), App IDs with budgeting before any write (clamped quota, next free slot, normalised names, conserve mode), app groups, devices, provisioning profiles, defensive parsing of every response, and `provisionApp()`, which yields everything the signer needs for an IPA and its extensions
- [x] **5. Installer engine and catalog**:
  - the pipeline runner (progress, cancel, resume, idempotent retry);
  - `@loadstar/catalog`: a release source catalog resolved through the GitHub API, streamed downloads, cache and checksum, and handling for sources that have gone;
  - IPA validation before any Apple call (structure, encryption, extension IDs, and against the device: minimum OS, device family, architecture) and signer reconciliation additions: `Extensions/` and `Watch/` bundles, Watch companion and BGTask identifiers, app and keychain groups, `ALTAppGroups` on every extension;
  - a remote source manifest (SideStore and LiveContainer stable/nightly, mirrors, SHA-256, iOS compatibility table);
  - flows: `installSideStore` (SideStore or LiveContainer + SideStore, including certificate injection: `ALTCertificate.p12` + `ALTCertificateID`, into the SideStore framework for LiveContainer), free-app-limit resolution, `installApps` (any IPA, preload), `placePairing` (several apps from a data-driven list of known apps and their pairing-file locations);
  - a diagnostics error catalog, the Engine facade, and `@loadstar/rpc`
- [ ] **6. UI foundation**: `@loadstar/ui` with HeroUI v3 and Tailwind v4 (no CSS files):
  - palette themes as TS data (Graphite, Ocean, Aurora, Sunset, Forest, Rose), each with light and dark variants;
  - i18n, TanStack Router and Query, `EngineClient`, a layout shell, and the log viewer;
  - translation foundation:
    - i18next with ICU plurals and gender (via `Intl`), and every user-visible string as a key, including every `ErrorCode` recovery screen; a lint check rejects hard-coded UI strings;
    - language picked automatically from the OS (Electron `app.getPreferredSystemLanguages()`), with a picker in settings and an English fallback for missing keys;
    - right-to-left layouts (Arabic, Hebrew, Persian, Urdu) built from logical Tailwind utilities (`ms-`/`me-`, `start`/`end`), with mirrored icons where meaning depends on direction;
    - locale-aware dates, numbers and lists (`Intl.DateTimeFormat`, `NumberFormat`, `ListFormat`, `RelativeTimeFormat`);
    - a pseudo-locale (accented and about 40 % longer) for catching truncation and untranslated strings, plus screenshot tests in German (long), Arabic (RTL) and Japanese (CJK)
- [ ] **7. Onboarding**: a first-run guided wizard with platform checks (usbmuxd / Apple Mobile Device driver, with copyable fixes per OS), network preflight (Apple, anisette, clock skew), connecting and trusting the device, Developer Mode, Apple ID sign-in with 2FA, team choice, and choosing what to install. It can be resumed and re-run from settings
- [ ] **8. Install and preload experience**: one-click SideStore (stable/nightly), a preload picker (local IPAs, URLs, catalog apps), source deep links and a QR code for SideStore, a live pipeline view, dedicated recovery screens for every `ErrorCode` with "copy diagnostics", an on-device checklist per iOS version, a "Repair SideStore" wizard, and one-click switching to another Apple ID when one is banned
- [ ] **9. Desktop app**: Electron 44 shell with Node adapters, a hardened preload (`contextIsolation`, typed RPC only), electron-builder packages (Windows NSIS, macOS DMG signed and notarized, Linux AppImage, deb and rpm), and auto-update
  - status: a minimal shell exists early (one window with `contextIsolation`, `sandbox`, a strict CSP and blocked navigation, rendering `@loadstar/ui`), and CI builds it with electron-vite on Linux, Windows and macOS. Packaging, signing and notarisation, auto-update, the Engine wiring and the hardened RPC preload remain
- [ ] **10. Management tools**: certificate and app-ID management, pairing files per app (place, export, version), certificate and account import/export (`.p12`), and developer portal tools
- [ ] **11. Wireless and remote pairing**: Wi-Fi device discovery and install, the iOS 17+ remote-pairing (RP) file for SideStore, and handling for a device that is visible over both USB and network
- [ ] **12. Release 1.0**: docs site, an upstream SideStore "preload manifest" proposal, translations, a security review (secrets, Electron hardening, CSP), a licence audit, and a tagged multi-platform release pipeline
  - translations: **every language iOS supports** (about 40), including:
    - Arabic, Catalan, Chinese (Simplified, Traditional, Hong Kong), Croatian, Czech, Danish, Dutch, English (US, UK, Australia), Finnish, French (France, Canada), German, Greek, Hebrew, Hindi, Hungarian, Indonesian;
    - Italian, Japanese, Korean, Malay, Norwegian, Polish, Portuguese (Brazil, Portugal), Romanian, Russian, Slovak, Spanish (Spain, Latin America), Swedish, Thai, Turkish, Ukrainian, Vietnamese;
    - plus Persian and Urdu, and any language the community adds;
  - process:
    - community translation through a hosted platform (Weblate's free plan for open-source projects), synced into the repository by pull request;
    - drafts may be machine-assisted, but are marked for review until a native speaker approves them;
  - CI fails on missing or extra keys and broken placeholders, and reports each language's completion; languages below 90 % are labelled "beta" in the picker

## Completed

| Milestone | Date |
|-----------|------|
| 0. Foundation | 2026-10-13 |
| 1. Signer | 2026-10-15 |
| 2. Device layer | 2026-10-15 |
| 3. Apple account (sign-in + device 2FA + app token verified with a real account; SMS refused by Apple) | 2026-10-15 |
| 4. Developer services | 2026-10-15 |
| 5. Installer engine and catalog | 2026-10-15 |

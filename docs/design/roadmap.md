# Project Roadmap

> Open-source, cross-platform SideStore installer with app preloading, built on a pure-TypeScript engine that is verified against Apple `codesign`.

Each milestone is a **phase**. Phases are ordered by dependency. Phases 3 and 4 (device, Apple) can run in parallel once Phase 1 is done.

## Milestones

- [x] **0. Foundation**: pnpm + Turborepo monorepo, TS 7 strict config, Biome, Vitest, the `kernel` package (Result, `LoadstarError`/`ErrorCode`, ports, bytes utils), a boundary checker (no `node:*`/DOM in `packages/`), and GitHub Actions CI on Linux, Windows and macOS (macOS also runs `codesign`)
- [x] **1. Signer**: production `@loadstar/signer` built from the spike and the format spec:
  - binaries: thin and fat, adding `LC_CODE_SIGNATURE` when missing, 4K/16K pages, SHA-1 + SHA-256 dual CDs for minimum iOS below 11;
  - bundles: frameworks, dylibs and appexes signed inner-first, plus streaming IPA read and write;
  - bundle ID, entitlement and profile reconciliation;
  - golden Apple fixtures, browser parity tests, and checking the CMS against a real Apple Development certificate
- [ ] **2. Web device feasibility spike**: answers whether WebUSB can claim an iPhone's usbmux interface on Windows, macOS, Linux and ChromeOS, and whether a JS/WASM TLS 1.2 client can complete lockdown `StartSession`. The output is a go/no-go and the decision on web device support (direct, driver swap, or helper app)
- [ ] **3. Device layer**: `@loadstar/device`:
  - usbmux client and lockdown;
  - pairing: read existing pair records and create new ones with a trust prompt;
  - services: TLS sessions, AFC, house_arrest, installation_proxy (install with progress, list apps);
  - checks: Developer Mode and locked device. Node adapters are tested on real hardware
- [ ] **4. Apple account**: `@loadstar/apple`:
  - anisette v3 client with a health-checked server chain and automatic fallback (native anisette on macOS);
  - GSA SRP-6a login, 2FA (trusted device and SMS, with non-fatal phone lookup), token refresh;
  - `SecretStore`-backed saved credentials
- [ ] **5. Developer services**: teams (team chooser), certificate CSR, create, list and revoke (with auto-revoke when the maximum is reached), app IDs and quota, app groups, devices, provisioning profiles, and `provisionApp()`, which yields everything the signer needs for an IPA and its extensions
- [ ] **6. Installer engine and catalog**:
  - the pipeline runner (progress, cancel, resume, idempotent retry);
  - `@loadstar/catalog`: a release source catalog resolved through the GitHub API, streamed downloads, cache and checksum, and handling for sources that have gone;
  - flows: `installSideStore`, `installApps` (preload), `placePairing`;
  - a diagnostics error catalog, the Engine facade, and `@loadstar/rpc`
- [ ] **7. UI foundation**: `@loadstar/ui` with HeroUI v3 and Tailwind v4 (no CSS files):
  - palette themes as TS data (Graphite, Ocean, Aurora, Sunset, Forest, Rose), each with light and dark variants;
  - i18n, TanStack Router and Query, `EngineClient`, a layout shell, and the log viewer
- [ ] **8. Onboarding**: a first-run guided wizard with platform checks (usbmuxd / Apple Mobile Device driver), connecting and trusting the device, Developer Mode, Apple ID sign-in with 2FA, team choice, and choosing what to install. It can be resumed and re-run from settings
- [ ] **9. Install and preload experience**: one-click SideStore (stable/nightly), a preload picker (local IPAs, URLs, catalog apps), source deep links and a QR code for SideStore, a live pipeline view, and dedicated recovery screens for every `ErrorCode`
- [ ] **10. Desktop app**: Electron 44 shell with Node adapters, a hardened preload (`contextIsolation`, typed RPC only), electron-builder packages (Windows NSIS, macOS DMG signed and notarized, Linux AppImage, deb and rpm), and auto-update
- [ ] **11. Web app and relay**: a Vite SPA with the engine in a Web Worker, browser adapters (WebUSB per the Phase 2 decision, a relay HTTP client, a session `SecretStore`), and the Hono relay (Apple allowlist and anisette relay) deployed to Cloudflare Workers
- [ ] **12. Management tools**: certificate and app-ID management, pairing files per app (place, export, version), certificate and account import/export (`.p12`), and developer portal tools
- [ ] **13. Wireless and remote pairing**: Wi-Fi device discovery and install, the iOS 17+ remote-pairing (RP) file for SideStore, and handling for a device that is visible over both USB and network
- [ ] **14. Release 1.0**: docs site, an upstream SideStore "preload manifest" proposal, translations, a security review (secrets, relay, CSP), a licence audit, and a tagged multi-platform release pipeline

## Completed

| Milestone | Date |
|-----------|------|
| 0. Foundation | 2026-10-13 |
| 1. Signer | 2026-10-15 |

# Loadstar

## Overview

Loadstar is an open-source, cross-platform tool that installs **SideStore** (and other apps) onto an iPhone or iPad from a computer or a browser. It signs into the user's Apple ID, obtains a free development certificate and provisioning profiles, re-signs the apps, installs them over USB (or Wi-Fi), places the pairing file SideStore needs to refresh itself, and optionally **preloads** extra apps and sources in the same session.

It is designed around the failure modes that most often break sideloading installers:

- Apple ID login failures (`Auth error -80045`). The fix is resilient anisette with health-checked fallback servers.
- `HTTP 404` on downloads. The fix is release resolution through the GitHub API from a configurable source catalog, not hardcoded asset URLs.
- "Verification failed" installs. The fix is a signer verified byte for byte against Apple `codesign`, plus entitlement and profile reconciliation.
- Opaque errors. The fix is a typed error catalog with plain-language explanations and next steps.

The whole engine is written in **TypeScript** and runs unchanged in Node/Electron and in Chromium browsers.

## Core Features

- **Guided onboarding.** A first-run wizard covers platform checks (usbmuxd / Apple Mobile Device driver), connecting and trusting the device, Developer Mode, Apple ID sign-in with 2FA (trusted device and SMS), and team selection.
- **One-click SideStore install.** Release channel choice (stable / nightly), automatic pairing-file placement, and a certificate import into SideStore.
- **Preload apps.** Sign and install a user-chosen set of extra IPAs (local files or URLs) in the same run. SideStore sources come pre-configured via deep links / QR code, and later through an upstream preload manifest.
- **Pure-TS code signer.** Mach-O CodeDirectory, CodeResources, entitlements (XML + DER), CMS, fat binaries, nested bundles. Verified against Apple `codesign`.
- **Device toolkit.** usbmux, lockdown, pairing, AFC, house_arrest and installation_proxy. Pairing files can be exported, versioned and managed per app.
- **Apple developer tools.** List and revoke certificates, list and delete app IDs, show remaining app-ID quota, import and export certificates.
- **Clear errors.** Detection of locked device, missing pair record, Developer Mode off, app-ID or certificate limits, `DeviceNotSupportedByThinning`, no internet, and similar conditions, each with a dedicated recovery screen.
- **Themes.** Several colour palettes, each with light and dark variants, defined as TypeScript data.
- **Localization** from day one (i18next).

## Tech Stack

- **Programming language:** TypeScript 7 (strict), ESM only
- **Monorepo:** pnpm 12 workspaces + Turborepo. Packages are source-only (`exports` → `src/index.ts`, no build step); the apps' bundlers compile them
- **UI:** React 19, HeroUI v3 (React Aria based), Tailwind CSS v4 (utility classes only, no hand-written CSS), Motion for animation, Lucide icons
- **UI state and data:** TanStack Router, TanStack Query (async/server state), Zustand (local UI state)
- **Desktop shell:** Electron 44 via electron-vite 5, packaged with electron-builder (Windows, macOS, Linux)
- **Web shell:** Vite 7 single-page app (Chromium; WebUSB)
- **Edge service:** Hono on Cloudflare Workers / Node. It is a CORS relay for Apple endpoints and an anisette relay, used only by the web shell.
- **Crypto and formats:** WebCrypto, pkijs + asn1js (CMS, CSR, X.509), @noble/hashes (fallback hasher), node-forge (legacy `.p12` import only, Phase 12), @zip.js/zip.js (IPA streaming). Plists use an **in-house** XML and binary parser and a CoreFoundation-exact writer, because `@plist/*` loses the real-vs-integer distinction.
- **Validation:** zod 4 at all I/O boundaries (e.g. provisioning profiles)
- **Quality:** Vitest 5, Playwright 1.64 (UI e2e and browser parity tests), Biome 2 (lint and format)
- **Database / ORM:** none. Local persistence uses the OS keychain (Electron `safeStorage`) and IndexedDB in the browser.

## Architecture Notes

- **Ports and adapters.** Core packages are pure TypeScript with no `node:*` or DOM imports. They define ports (`DeviceTransport`, `HttpClient`, `SecretStore`, `FileSource`, `Clock`, `Logger`), and each shell provides adapters.
- **Verified signer.** It is developed against golden fixtures produced by Apple `codesign` on macOS CI.
- **Install pipeline.** An explicit, resumable sequence of typed steps. Each step emits progress events and fails with a catalogued error.
- **Release catalog.** Release sources (SideStore, LiveContainer, user sources) are data, resolved through the GitHub Releases API. Upstream repository moves and deletions are expected, not exceptional. LiveContainer's GitHub repository returned 404 on 2026-10-13.

See `docs/design/architecture.md` for the full architecture guidelines.

## Non-Functional Requirements

- **Correctness:** signer output must pass `codesign --verify --deep --strict` in CI. CodeDirectory, CodeResources and entitlement blobs must stay byte-identical to Apple `codesign` for the golden fixtures.
- **Portability:** core packages run in Node ≥22 and Chromium ≥120. Signing must also work inside a Web Worker.
- **Performance:** signing SideStore takes under 1 s on desktop and under 2 s in the browser. IPAs are streamed and never fully buffered when that can be avoided.
- **Security:**
  - Apple passwords are never persisted in plain text. Credentials go in the OS keychain (desktop) or are session-only (web).
  - Private keys never leave the device except through an explicit user export.
  - The web relay is stateless and stores nothing.
- **Logging:** structured logger port with levels (`LOG_LEVEL`), redaction of tokens, passwords and serials, and an in-app log viewer.
- **Error handling:** typed `LoadstarError` with a stable `code`, a user message key and a recovery action. No raw stack traces in the UI.
- **Accessibility:** WCAG 2.2 AA through React Aria primitives, with full keyboard navigation.
- **Licensing:** MIT (proposed). No code copied from other sideloading tools, ldid (AGPL) or ipa-resign (proprietary). zsign and rcodesign are used as references only.

## Architecture

Detailed architecture guidelines are in `docs/design/architecture.md`.
Pattern: Explicit Architecture (ports & adapters), adapted to a package-per-bounded-context monorepo.

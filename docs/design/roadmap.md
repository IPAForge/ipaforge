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
| Every known failure detected and handled: automatic retry or fix where possible, otherwise a recovery screen (catalogue built from real user reports: `docs/design/failure-catalogue.md`) | all |

## Milestones

- [x] **0. Foundation**: pnpm + Turborepo monorepo, TS 7 strict config, Biome, Vitest, the `kernel` package (Result, `IPAForgeError`/`ErrorCode`, ports, bytes utils), a boundary checker (no `node:*`/DOM in `packages/`), and GitHub Actions CI on Linux, Windows and macOS (macOS also runs `codesign`)
- [x] **1. Signer**: production `@ipaforge/signer` built from the spike and the format spec:
  - binaries: thin and fat, adding `LC_CODE_SIGNATURE` when missing, 4K/16K pages, SHA-1 + SHA-256 dual CDs for minimum iOS below 11;
  - bundles: frameworks, dylibs and appexes signed inner-first, plus streaming IPA read and write;
  - bundle ID, entitlement and profile reconciliation;
  - golden Apple fixtures and checking the CMS against a real Apple Development certificate
- [x] **2. Device layer**: `@ipaforge/device`:
  - usbmux client and lockdown;
  - pairing: read existing pair records and create new ones with a trust prompt;
  - services: TLS sessions, AFC, house_arrest, installation_proxy (install with progress, list apps), misagent (profiles on the device);
  - checks: Developer Mode and locked device. Node adapters are tested on real hardware
- [x] **3. Apple account**: `@ipaforge/apple`:
  - anisette v3 client with a health-checked server chain and automatic fallback (native anisette on macOS), plus an opt-in **local anisette** provider: a Provision `anisette-server` sidecar that downloads Apple's libraries itself, so no third-party server is needed (reviewed Dadoum/Provision for ideas only: it can't be pure TypeScript and Apple's libraries can't be redistributed; v1 protocol client done, sidecar process management moves to Phase 9);
  - GSA SRP-6a login, 2FA (trusted device and SMS, with non-fatal phone lookup), token refresh;
  - multiple Apple IDs: `SecretStore`-backed saved accounts with switch, sign-out and per-account team/certificate state;
  - Apple-facing client identity as remotely updatable data (from the anisette server's `client_info` or signed config), never constants;
  - a full 2FA state machine (device push, SMS number picker, resend, legacy 4-digit codes, server-provided code length, "code already sent" states, security-key explanation);
  - automatic recovery for every known login failure (`docs/design/failure-catalogue.md`): anisette failover and re-provisioning, clock-skew and connectivity preflight, backoff on 429/503, no auto-retry on wrong passwords, account health and ban flags
- [x] **4. Developer services**: teams (team picker remembered per Apple ID), certificate lifecycle (reuse by machine name and key, a revoke picker showing which tool created each certificate, per-type revoke, `.p12` export/import with the `machineId` password), App IDs with budgeting before any write (clamped quota, next free slot, normalised names, conserve mode), app groups, devices, provisioning profiles, defensive parsing of every response, and `provisionApp()`, which yields everything the signer needs for an IPA and its extensions
- [x] **5. Installer engine and catalog**:
  - the pipeline runner (progress, cancel, resume, idempotent retry);
  - `@ipaforge/catalog`: a release source catalog resolved through the GitHub API, streamed downloads, cache and checksum, and handling for sources that have gone;
  - IPA validation before any Apple call (structure, encryption, extension IDs, and against the device: minimum OS, device family, architecture) and signer reconciliation additions: `Extensions/` and `Watch/` bundles, Watch companion and BGTask identifiers, app and keychain groups, `ALTAppGroups` on every extension;
  - a remote source manifest (SideStore and LiveContainer stable/nightly, mirrors, SHA-256, iOS compatibility table);
  - flows: `installSideStore` (SideStore or LiveContainer + SideStore, including certificate injection: `ALTCertificate.p12` + `ALTCertificateID`, into the SideStore framework for LiveContainer), free-app-limit resolution, `installApps` (any IPA, preload), `placePairing` (several apps from a data-driven list of known apps and their pairing-file locations);
  - a diagnostics error catalog, the Engine facade, and `@ipaforge/rpc`
- [x] **6. UI foundation**: `@ipaforge/ui` with HeroUI v3 and Tailwind v4 (no CSS files):
  - palette themes as TS data (Graphite, Ocean, Aurora, Sunset, Forest, Rose), each with light and dark variants;
  - i18n, TanStack Router and Query, `EngineClient`, a layout shell, and the log viewer;
  - translation foundation:
    - i18next with ICU plurals and gender (via `Intl`), and every user-visible string as a key, including every `ErrorCode` recovery screen; a lint check rejects hard-coded UI strings;
    - language picked automatically from the OS (Electron `app.getPreferredSystemLanguages()`), with a picker in settings and an English fallback for missing keys;
    - right-to-left layouts (Arabic, Hebrew, Persian, Urdu) built from logical Tailwind utilities (`ms-`/`me-`, `start`/`end`), with mirrored icons where meaning depends on direction;
    - locale-aware dates, numbers and lists (`Intl.DateTimeFormat`, `NumberFormat`, `ListFormat`, `RelativeTimeFormat`);
    - a pseudo-locale (accented and about 40 % longer) for catching truncation and untranslated strings, plus screenshot tests in German (long), Arabic (RTL) and Japanese (CJK)
  - done along the way: the 2FA code field takes the length Apple asks for, 4-digit codes for older (`hsa`) accounts included (#40); devices coming and going (a refresh, a cable wiggle) never open a full-screen error, the picker and the Devices page say it quietly (#45); a keyboard shortcut to open the logs, Ctrl+L or ⌘L on macOS (#56)
  - still open:
    - recovery: a dedicated error for an app that doesn't support the device (installation_proxy `DeviceNotSupportedByThinning`, today the generic `device.install_failed`), with its own screen
    - to check by hand: the sign-in dialog with password managers filling the form (e.g. Bitwarden)
  - progress (one PR per step):
    - [x] 6a: UI package, palettes and the sidebar shell (#28), with a minimal Electron shell (#29, #34)
    - [x] 6b: translations, on-demand languages, right-to-left and locale checks (#36); code style (#37)
    - [x] 6c-1: the UI connected to the Engine, with live device updates (#39)
    - [x] 6c-2: adding an Apple ID from the top bar (#40)
    - [x] 6c-3: accounts and teams (#42); Mac-backed anisette servers first (#43)
    - [x] 6c-4: device picker and Devices page (#45)
    - [x] 6c-5: install home and install run (#46)
    - [x] 6c-6: the run's questions (#53)
    - [x] quality: SonarJS lint (#41, #44); file structure rules across the project (#48–#52); renamed from Loadstar to IPAForge (#57)
    - [x] 6c-7: recovery: a fix per error, Report the problem as a pre-filled GitHub issue, Apple pages opened in the browser (#54)
    - [x] 6c-8: step details: what each step did (release version, session reused, team, certificate, App IDs, free apps) (#55)
    - [x] 6d: log buffer, log stream and log viewer: paged and searched in the Engine, a virtual list, live lines, Copy and Save, debug details, Show logs for a failed run, Ctrl+L (#56)
    - [x] 6e: screenshot and accessibility tests per locale: every main screen in five languages and dark mode, clipped-text, WCAG 2.2 AA and keyboard checks in a real Chromium, Linux references made in Docker; contrast fixes for muted, red and amber text (#58)
- [ ] **7. Onboarding**: a first-run guided wizard with platform checks (usbmuxd / Apple Mobile Device driver, with copyable fixes per OS), network preflight (Apple, anisette, clock skew), connecting and trusting the device, Developer Mode, Apple ID sign-in with 2FA, team choice, and choosing what to install. It can be resumed and re-run from settings
  - progress:
    - [x] 7a: the setup guide on the first launch, in place of the pages: Welcome (language), This computer (`engine.systemCheck`: the iPhone connection service with the fix for this system, Apple's servers, the clock, the anisette servers), Your iPhone (connected, trusted, unlocked, Developer Mode), Apple ID (sign-in and the team); opening by itself while no Apple ID is saved; any step skipped or opened from the list, Finish later with a banner to continue, Settings › Setup guide to run it again; and the tour of the pages (9 stops), starting whenever the guide closes, from its compass button in the top bar and from Settings › Show me around; Settings in two tabs (General as a settings list: appearance and language, the setup guide; Anisette servers), and two more palettes, Violet and Mocha, with every palette tinting its backgrounds so they tell apart (#95)
    - [ ] 7b: installing SideStore from the guide (or Not now) and the after-install steps on the iPhone
- [x] **8. Install and preload experience**: one-click SideStore (stable/nightly), a preload picker (local IPAs, URLs, catalog apps), source deep links and a QR code for SideStore, a live pipeline view, dedicated recovery screens for every `ErrorCode` with "copy diagnostics", an on-device checklist per iOS version, a "Repair SideStore" wizard, and one-click switching to another Apple ID when one is banned
  - progress (most built during Phase 6c):
    - [x] one-click SideStore or LiveContainer + SideStore, Stable or Nightly (#46)
    - [x] a live pipeline view (#46), with the run's questions (#53) and what each step did (#55)
    - [x] recovery screens for every `ErrorCode`, with copy diagnostics and a pre-filled issue report (#54)
    - [x] switching to another Apple ID when one is banned: the Install notice (#45) and the recovery picker (#54)
    - [x] 8-1: the preload picker: drop or choose IPAs, add a link, or pick from the catalog (now with LiveContainer, StikDebug and Feather, release names with a `*` wildcard), each app checked by the Engine when added, the list added up against App IDs and free-app slots, one run with the steps grouped by app; SideStore installed this way gets its pairing file too (#59)
    - [x] fix: the trusted-device code is always asked for (Apple answers `hsc 409` with `au = trustedDeviceSecondaryAuth` and sends nothing until asked), the code step comes straight away, with Send a new code and Text a number instead (#60)
    - [x] 8-1b: app sources: AltStore-format sources read by the catalog (lenient parsing, https `.ipa` downloads only, a last good copy kept per source), the IPAForge catalog and SideStore's source built in and trusted, others added by link with a preview; Preload gets two tabs, Add apps (Browse apps: every source's apps, each once, with a source filter, search and details with a version picker) and Sources (add, turn off, refresh, remove) (#66)
    - [x] install progress in detail: a running step shows a bar with the bytes, speed and time left (downloads, sending the app to the device), the provisioning task and its requests to Apple ("Getting profiles · 2 of 5"), or iOS's own percent and phase, the run its time left; the device line says USB or Wi-Fi, a notice suggests a cable over Wi-Fi, and signed IPAs are compressed over Wi-Fi (#67)
    - [x] 8-1c: the **Apps** section: the apps installed on the device with their expiry (read from its profiles), Refresh from the kept IPA (data and certificate trust kept), Update from the app's source, Remove, apps other tools signed with the same teams, and automatic refresh while IPAForge is open; an IPAForge mark in each app (origin and certificate) so other computers recognise it, and a SideStore-style Refresh (new profiles only while the certificate holds, installed again otherwise, with the reason); Browse apps cards redesigned; every language reviewed (#68)
    - [x] SideStore links and QR codes: Add to SideStore on each source you added (and Add all, one code after another), Install with SideStore in an app's details (the version picked), offered again after a SideStore install; the Sources tab's text and buttons on separate lines, and a Browse apps card opens its details anywhere on it, catalog apps included (their releases read from GitHub when they open) (#71)
    - [x] the on-device checklist per iOS version, under each device on the Devices page: what IPAForge sees ticked live (connected, unlocked, trusted, Developer Mode, LocalDevVPN installed), what only you can see yours to tick (kept per device), reminders for what holds each time, folded into "set up" once done; Show the option for Developer Mode, LocalDevVPN's App Store code; a line on Install and Preload while something is left (#72)
    - [x] Repair SideStore: from SideStore's row in Apps, a page that checks, one line after another, the device, who signed SideStore, its version, expiry, the certificate that signed it (or "can't tell" without IPAForge's mark), the certificate it holds and its pairing file, lists what only the user can check on the iPhone, and runs the needed fixes (plus the offered ones picked) in one run, never installing it again over another team's or Apple ID's; an app IPAForge didn't install is installed again from the source that lists its installed version first, with a picker when several sources list it (#70)
  - checked with LiveContainer 3.8.0: its LiveProcess extension declares the app's 128 shared keychain groups but names no team, so they weren't moved and were dropped; the old team now comes from the groups' own prefix, and LiveProcess shares the app's keychain (#73)
  - AFC writes in 1 MiB chunks instead of 64 KiB: 2.4× faster over Wi-Fi as measured on an iPhone (`device-probe afc-speed`: 2.7 → 6.4 MiB/s; 4 MiB adds little) (#73)
  - later: AltStore as an install target (`ALTDeviceId` in `Info.plist` and an encrypted `ALTPairingFile.dat` at the bundle root)
  - when Apple reports a negative number of App IDs left, the error says the count looks wrong and Try anyway asks Apple to create them (#73)
  - an app IPAForge didn't install is never installed again first from a source whose version is older than the device's; the picker says "older than installed" (#73)
  - anisette servers in Settings: Automatic (the user's servers, then the last that worked, SideStore's list in its order, then the built-in servers as a backup) or one chosen server; test one or all, update SideStore's list, add, edit and remove your own (http allowed only for these), a note on the list's non-HTTPS servers, a warning when the chosen server doesn't answer; "Choose another anisette server" opens the card. Also: background checks never ask Apple for a 2FA code, Sign in again uses the saved password and asks only for the code, a refused keychain prompt is asked again, nothing but the update check runs until it's done, the app's mark in the top bar, and a note when the Intel build runs under Rosetta (#80)
  - days left counted as SideStore counts them (calendar days, so a fresh profile says 7), and Refresh installs SideStore over itself (data kept) at the version on the device, so its own screen shows the new date; a refresh never changes an app's version (the kept copy only when it's that version, else that version downloaded, else Update), and other apps still get a new profile only (#81)
  - an install whose device goes silent (it locked mid-install) stops after 90 seconds with `device.timeout` instead of waiting forever, Cancel stops a run during the install step too, and the Apps page has Cancel refresh while a refresh or update runs (#93)
- [x] **9. Desktop app**: Electron 44 shell with Node adapters, a hardened preload (`contextIsolation`, typed RPC only), electron-builder packages (Windows NSIS, macOS DMG signed and notarized, Linux AppImage, deb and rpm), and auto-update
  - status: the shell (one window with `contextIsolation`, `sandbox`, a strict CSP and blocked navigation, rendering `@ipaforge/ui`) runs the real Engine over the rpc MessagePort, CI builds and Sigstore-signs it on Linux, Windows and macOS, and it updates itself (each update's signature checked); Windows code signing and Apple notarisation moved to 1.0
  - progress:
    - [x] alpha installers with electron-builder: macOS DMG (Apple silicon and Intel, ad-hoc signed), Windows NSIS (x64), Linux AppImage (x64, arm64), deb and rpm; a release workflow that builds them on a version tag and publishes a GitHub release (a pre-release for `-alpha`/`-beta`/`-rc`) with checksums and the notes in `docs/releases/` (#61)
    - [x] the macOS build is signed on pull requests too and its signature checked in CI; the window opens before the keychain is touched, which happens on first use; Accounts says when Apple IDs can't be saved; a credit at the foot of the sidebar; every workflow action pinned to a commit (#62)
    - [x] release files like other sideloaders ship: macOS `.zip` per architecture, Windows `.msi`, Linux deb and rpm for arm64 too, update metadata (`latest*.yml`, blockmaps), and a keyless Sigstore signature for every file, checked on pull requests before publishing (#63)
    - [x] the macOS app signed with IPAForge's own self-signed certificate (afterSign hook, certificate in repository secrets, its SHA-1 pinned and checked in CI), so the keychain trusts every version; step-by-step first-open instructions (#64)
    - [x] release 0.1.0-alpha.2: the first release with the self-signed macOS app, the extra installers and Sigstore signatures (#65)
    - [x] release 0.1.0-alpha.3: app sources, detailed install progress and the Apps section with SideStore-style refresh (#69)
    - [x] release 0.1.0-alpha.4: Repair SideStore, SideStore QR codes, the on-device checklist, faster Wi-Fi installs, and the first version that updates itself, every update checked against its release's Sigstore signature (#75)
    - [x] release 0.1.0-alpha.5, the first from the IPAForge organization: updates look for releases there (accepting signatures from the repository's old name too), the website and the AGPL-3.0 licence (#77)
    - [x] release 0.1.0-alpha.6: anisette servers in Settings, sign-in that asks less, Refresh keeping the version, SideStore's remote pairing, and ipaforge.com rebuilding by itself (#85)
    - [x] release 0.1.0-alpha.7: the Developer Portal, pairing files per app, saving signed `.ipa` files, `.p12` export and import, installs that never hang on a locked device, Patreon and the new Discord invite (#94)
    - [x] auto-update on launch with electron-updater from the GitHub releases: the window waits behind an update screen while IPAForge checks, downloads (with progress) and installs the new version, then reopens; offline or a slow check opens the app, a failed download offers Try again, the release page or going on; copies from a .msi, .deb or .rpm, which can't update themselves, name the file to download. The state reaches the UI over its own MessagePort (`serveUpdates`/`createUpdateClient` in `@ipaforge/rpc`). What's new opens once after an update (the notes in New, Changed, Fixed and Removed lists) and the changelog page lists every version; the notes are in English, bundled in the UI (#74)
    - [x] every update is checked before it installs: its file must carry a Sigstore signature from `release.yml` on that version's own tag (sigstore-js against Sigstore's public logs), else the update screen says it failed; an install that fails before IPAForge quits says so too. Two small pnpm patches (`patches/`) name SHA-256 where `@sigstore/core` and `@tufjs/models` verify EC and RSA signatures without a hash: OpenSSL assumes it, Electron's BoringSSL refuses (`NO_DEFAULT_DIGEST`) (#74)
    - [x] the certificates the OS trusts (company proxies, self-hosted anisette servers with their own CA) are trusted for Apple and anisette requests and by Node's default, alongside Node's bundled roots and Apple's (`tls.getCACertificates('system')`) (#74)
- [x] **10. Management tools**: certificate and app-ID management, pairing files per app (place, export, version), certificate and account import/export (`.p12`), and developer portal tools
  - progress:
    - [x] **10a** the Developer Portal page (Certificates in the sidebar before): the team's certificates (who made each, this computer's, which apps on the device each signs, Revoke with what stops opening), App IDs (the app using each, Unused, Delete, the weekly limit), the device's provisioning profiles (Expired, Unused, Another team, Remove and Remove unused), app groups and registered devices, in small tabs with counts, also used by Preload (#86)
    - [x] **10b** pairing files per app, in one Pairing files dialog on the Apps page: whose files each pairing app and each other app IPAForge installed holds, Place, Remove, a path of your own for your own apps, a new remote pairing for SideStore, a No pairing file tag on an app that needs one, and Save pairing file on the Devices page (#87)
    - [x] **10c** Save signed .ipa instead, per app on Preload: signed for the team and saved in a folder picked in the host's dialog (named by an id, never a path from the page), without the certificate's private key, in the same run as the apps installed (#90)
    - [x] **10d** `.p12` export and import on the Developer Portal's certificates: this computer's certificate and key under a password typed twice, and a `.p12` from another computer or SideStore (legacy 3DES or RC2, or AES with PBKDF2) kept as this computer's once Apple lists its certificate for the team and the key is its own; no new certificate, no slot used (#93)
  - later: signing in with a security key (today detected and explained, not completed)
- [ ] **11. Wireless and remote pairing**: pairing over Wi-Fi and finding devices beyond those usbmuxd lists, and the iOS 17+ remote-pairing (RP) file for SideStore
  - already in: installing over Wi-Fi to a device usbmuxd sees on the network (compressed, 1 MiB AFC writes), and a device seen over both USB and Wi-Fi listed once
  - **11.1** remote pairing for SideStore (iOS 17.4 and later): made over USB through the lockdown service `com.apple.dt.remotepairingdeviced.lockdown` (JSON framed with `RPPairing` and a 2-byte big-endian length, no tunnel): pair-setup (SRP-6a, 3072-bit group, SHA-512, the fixed USB PIN; Ed25519 identities under ChaCha20-Poly1305, the device's signature checked) and pair-verify before a saved one is reused. One identity per device, kept encrypted. SideStore gets it as its own file, `PairingFile_RemoteRP.plist` (`public_key`, `private_key`, `identifier`, `alt_irk`), next to the classic `PairingFile_Lockdown.plist`: a file with both key sets is ambiguous to SideStore. Repair SideStore checks it. Also: anisette server tests ask once, without retries (#82)
  - **11.2** installing through the iOS 17+ device tunnel (RSD/CoreDevice), over USB and Wi-Fi, without depending on the system's usbmuxd for Wi-Fi, and finding devices on the network
  - **11.3** Apple TV and Vision Pro as targets: found on the network, paired with the PIN on screen, installs through the 11.2 tunnel
  - not planned: Apple Watch as a target (Watch apps install with their iPhone app; installing to the Watch directly isn't documented)
- [ ] **12. Release 1.0**: docs site, an upstream SideStore "preload manifest" proposal, translations, a security review (secrets, Electron hardening, CSP), a licence audit, and a tagged multi-platform release pipeline
  - code signing: a Windows certificate (SignPath Foundation for open source, or Azure Trusted Signing), and an Apple Developer ID with notarisation and the hardened runtime
  - translations: **every language iOS supports** (about 40), including:
    - Arabic, Catalan, Chinese (Simplified, Traditional, Hong Kong), Croatian, Czech, Danish, Dutch, English (US, UK, Australia), Finnish, French (France, Canada), German, Greek, Hebrew, Hindi, Hungarian, Indonesian;
    - Italian, Japanese, Korean, Malay, Norwegian, Polish, Portuguese (Brazil, Portugal), Romanian, Russian, Slovak, Spanish (Spain, Latin America), Swedish, Thai, Turkish, Ukrainian, Vietnamese;
    - plus Persian and Urdu, and any language the community adds;
  - process:
    - community translation through a hosted platform (Weblate's free plan for open-source projects), synced into the repository by pull request;
    - drafts may be machine-assisted, but are marked for review until a native speaker approves them;
  - CI fails on missing or extra keys and broken placeholders, and reports each language's completion; languages below 90 % are labelled "beta" in the picker
  - publishing reusable packages to npm, from this monorepo (no separate repositories):
    - candidates: `@ipaforge/signer` first (pure-TypeScript iOS code signing), then `@ipaforge/device` (usbmux, lockdown, AFC, installation_proxy and the other device services), and the generic plist codec and byte helpers from `kernel` as a small package of their own;
    - kept private: `catalog`, `installer`, `rpc` and `ui` (IPAForge's product), and `apple` unless we decide otherwise, because it automates Apple's private endpoints;
    - prerequisites: a build step (compiled JavaScript plus `.d.ts`, internal `@…` aliases resolved), per-package error codes instead of the app-wide catalogue, a semver-stable API with a README per package, and release tooling (e.g. Changesets) that versions and publishes from the monorepo

## Completed

| Milestone | Date |
|-----------|------|
| 0. Foundation | 2026-10-13 |
| 1. Signer | 2026-10-15 |
| 2. Device layer | 2026-10-15 |
| 3. Apple account (sign-in + device 2FA + app token verified with a real account; SMS refused by Apple) | 2026-10-15 |
| 4. Developer services | 2026-10-15 |
| 5. Installer engine and catalog | 2026-10-15 |
| 6. UI foundation | 2026-10-18 |

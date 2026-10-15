# Research

> Findings that shaped Loadstar's design. Updated: 2026-10-15. Detailed references live in `docs/design/`.

## Active Summary

- A **pure-TypeScript iOS code signer is feasible and was proven** in a spike. Its output is byte-identical to Apple `codesign` and runs identically in Node 22 and Chrome 155.
- Sideloading installers typically fail in **auth (anisette)**, **hardcoded download URLs**, **signing/provisioning**, and **opaque errors**. Loadstar's architecture targets each one.
- **LiveContainer's GitHub repository is gone** (404 under both org and original owner). Release sources must be data, and their disappearance must be a handled error.
- **Sideloader / Provision (Dadoum, GPL-3.0 / no SPDX licence)** are ideas only, never code. Take on-device profile management (misagent) into Phase 2; consider local anisette (Provision) as an opt-in sidecar in Phase 3. The CoreTrust bypass ("trollsign") is out of scope.
- **Real-world failures are catalogued** in `references/failure-catalogue.md` (about 800 user reports, 2026-10-15). The biggest causes are anisette/Apple client identity (~30 %), pairing and device state (~15 %), team-level profile bans (~7 %), and App ID/certificate limits. Every phase plans against that catalogue.
- **Preloading SideStore sources** cannot be done directly over USB today. Plan: show deep links and a QR code (v1), then propose an upstream "preload manifest" in SideStore.

## 1. Signer spike (2026-10-13)

Format spec: `docs/design/signer-spec.md`.
Library survey: `docs/design/js-libs.md`.

| # | Test | Result |
|---|---|---|
| 1 | CodeDirectory, requirements and SuperBlob for SideStore 0.7.0-alpha (main app, widget appex, OpenSSL.framework) vs Apple `codesign` ad-hoc | byte-identical |
| 2 | Entitlements XML blob + DER blob vs Apple, including a stress case (integers, `false`, Unicode, nested and empty arrays, key casing) | byte-identical |
| 3 | `_CodeSignature/CodeResources` for all 3 bundles vs Apple | byte-identical |
| 4 | Full SideStore signed from scratch with a certificate + CMS (pkijs) | `codesign --verify --deep --strict` passes; `openssl cms -verify` passes |
| 5 | Same code in headless Chrome 155 vs Node 22 | 146/146 output files byte-identical (signing took 910 ms in Chrome, 257 ms in Node) |
| 6 | Fat arm64 + arm64e binary; dylib without `LC_CODE_SIGNATURE` | both verify |

Facts learned (all confirmed against Apple output):

- **Hash type.** Current `codesign` emits a single **SHA-256** CodeDirectory (v`0x20400`). SHA-1 + SHA-256 dual CDs are needed only when the minimum iOS version is below 11.
- **Page size.** `codesign` 26.5 uses **16 KiB pages for arm64 when minimum iOS ≥ 16**, otherwise 4 KiB. The kernel accepts both, so make it a parameter.
- **Entitlements XML blob.** The XML blob holds the entitlements file **bytes verbatim**. `codesign` only reformats them for display.
- **DER entitlements.**
  - Booleans are encoded as `0xff`.
  - Dict entries are sorted by key bytes.
  - Dicts use tag `0xB0` (some third-party signers use `0x31`, which is wrong).
- **`CodeResources` for iOS bundles.**
  - The rules are flat, with no nested-code rules.
  - Frameworks and appexes are sealed as plain files.
  - `files2` carries `hash2` (SHA-256) only. `files` still uses SHA-1.
- **Slot order.**
  - Executables: `0, 2, 5, 7, 0x10000`.
  - Frameworks and dylibs: `0, 2, 0x10000`.
- **Exec-segment flags.** `0x11` (main binary + allow-unsigned) when `get-task-allow` is set; `0` for frameworks.
- **Team ID** (taken from the certificate OU) must be present on **every** binary.
- **Padding.** Bytes after the SuperBlob inside the reservation are not hashed. Apple leaves stale bytes there, so tests compare only up to the end of the SuperBlob.
- **Endianness.** Mach-O load commands are little-endian. Code-signature blobs are big-endian.

Still to verify in Phase 1: CMS byte-for-byte against a **real Apple Development certificate** (certificate order, attribute order). This needs a disposable real `.p12` in a temporary keychain.

### Library choices (from the survey)

| Concern | Pick | Note |
|---|---|---|
| CMS / CSR / X.509 | pkijs + asn1js | Supports Apple's custom signed attributes. node-forge can't. |
| Hashing | WebCrypto (batched) + @noble/hashes fallback | Chrome WebCrypto ≈ 1.6 GB/s; noble ≈ 80 MB/s in the browser. |
| `.p12` import | node-forge 1.4.0 | Only for legacy 3DES/RC2 `.p12` files. |
| ZIP | @zip.js/zip.js | Preserves symlinks, unix mode and exec bits; streams. |
| Plist | @plist/* | XML and binary. Note that it loses the real-vs-integer distinction. |
| Avoid | ipa-resign (proprietary), ldid (AGPL) | Don't read or copy. |

## 2. Common failure modes and scope

The failure classes that most often break sideloading installers, each of which Loadstar's design addresses:

1. **Login failures** (e.g. `Auth error -80045`). These come from anisette/GSA: third-party anisette servers that are down, rate-limited or flagged.
2. **`HTTP 404` on download.** Hardcoded `github.com/<org>/<repo>/releases/latest/download/<asset>` URLs break when upstream renames or deletes an asset or repository.
3. **"Verification failed" / "application verification failed"**: signing and provisioning mismatches.
4. **Credential-storage and device errors** with no explanation of what to do next.

Scope items that follow from this:

- detecting a locked device or a missing PairRecordData;
- clear screens for app-ID or app-count limits, plus options when app IDs run out;
- saved credentials, automatic anisette fallback or local anisette, and a team chooser;
- import/export of certificates, accounts and pairing files, with pairing-file versioning;
- Developer Mode detection, a no-internet warning, and developer portal tools;
- treating a failed trusted-phone-number lookup as non-fatal;
- file pickers that can be cancelled or closed without hanging the app.

## 3. SideStore integration facts (SideStore repo, 2026-10)

- **Pairing files:**
  - Lockdown: `PairingFile_Lockdown.plist`, plus the legacy name `ALTPairingFile.mobiledevicepairing`.
  - Remote pairing: `PairingFile_RemoteRP.plist`.
  - Both are placed in the app's Documents folder via house_arrest. This works because a dev-signed app has `get-task-allow`.
- **Deep links** (`SideStore/DeepLinks/URLHandler.swift`): `sidestore://source?url=…`, `sidestore://install?url=…`, `sidestore://pairing?urlname=…`, `sidestore://certificate?callback_template=…`.
- **Anisette.** The default anisette server comes from the `ALTAnisetteURL` Info.plist key (`https://ani.sidestore.io`). The server list comes from `https://servers.sidestore.io/servers.json`.
- **Default sources** come from `https://sidestore.io/default-sources`. Sources live in SideStore's database, which isn't reachable over USB. That's the reason for the upstream preload-manifest proposal.
- **Releases.** The latest SideStore release at the time of research was `0.7.0-alpha`, asset `SideStore.ipa` (27.8 MB). It contains `PlugIns/AltWidgetExtension.appex`, `Frameworks/OpenSSL.framework` and a nested `SideBackup.ipa`.

## 4. Prior art: Dadoum/Sideloader and Provision (2026-10-15)

Reviewed for ideas only. **Sideloader is GPL-3.0** (D language), so our clean-room policy forbids copying its code; Provision has no SPDX licence.

- **Sideloader** (last commit 2026-09-18, about 1k stars): CLI + GTK frontends. Its device layer is C bindings to `libimobiledevice` (lockdown, AFC, house_arrest, installation_proxy, misagent), not protocol code, so there is nothing to port to a TypeScript engine.
  - Its features (free-account certificates and app IDs, signing, SideStore pairing-file setup, bundled Apple root + WWDR G3) are already covered by Phases 1–4.
  - **misagent** (`com.apple.misagent`): lists, installs and removes provisioning profiles on the device. **Adopted for Phase 2** (protocol from libimobiledevice docs as a reference).
  - **trollsign**: a CoreTrust bypass using TrollStore 2's method (CVE-2023-41991). **Out of scope** (no exploit or jailbreak work).
  - Multi-threaded signing: not needed (SideStore signs in about 0.5 s).
- **Provision** (last release 2.2.0, 2023): generates anisette data locally by loading Apple Music's Android libraries (`libstoreservicescore.so`, `libCoreADI.so`) and registering the machine with Apple (ADI data in `~/.adi/adi.pb`). It ships an `anisette-server` binary for Linux/Windows.
  - It removes the dependency on third-party anisette servers, the root cause of `-80045` login failures.
  - It cannot be pure TypeScript (it is an ELF loader for Android libraries), Apple's libraries cannot be redistributed, and the licence is unclear.
  - **Decision for Phase 3:** public anisette servers stay the default. A local `anisette-server` sidecar, which the user opts into and which downloads Apple's libraries itself, is an optional fallback provider.

## 5. Failure catalogue (2026-10-15)

Summary of `references/failure-catalogue.md`:
- Apple-facing identity (client info, user agent) must be remotely updatable data, ideally from the anisette server's `/v3/client_info`. Hardcoded identities caused waves of `-80045` and HTTP 503.
- Anisette servers need health checks and automatic failover; users should never have to pick one.
- Pairing needs a passcode, an unlocked device and accepted trust prompts; Wi-Fi debugging (`EnableWifiDebugging`) answers `MissingValue` without a passcode.
- Team-level bans (`0xe8008024`) cannot be fixed client-side: switching to another saved Apple ID is the fix, so multi-account support is a recovery path, not a convenience.
- Free accounts: 10 App IDs per 7 days (LiveContainer + SideStore normally costs 5), 3 active free-profile apps per device.

## 6. Device layer on real hardware (2026-10-15)

`apps/desktop` device probe and the `LOADSTAR_DEVICE` suite against an iPhone on iOS 26 on macOS, over Wi-Fi sync, read-only:
- The pair record macOS stores in usbmuxd parses (binary plist). Its certificates are **SHA-1 with empty subject/issuer names**, so OpenSSL treats them as self-signed and refuses SHA-1 above security level 0. Device TLS therefore authenticates by pinning the exact device certificate and runs at `@SECLEVEL=0` for device connections only.
- Lockdown session + TLS, `GetValue`, installation_proxy `Browse`, misagent `CopyAll`, house_arrest `VendDocuments` + AFC stat all work.
- LiveContainer + SideStore keeps the pairing file at `Documents/SideStore/Documents/ALTPairingFile.mobiledevicepairing` in the LiveContainer container (confirmed on device). SideStore 0.7.0 nightly (2026-09-11) still reads `ALTPairingFile.mobiledevicepairing`.
- **Writes (2026-10-15, same device):** an AFC write/stat/read/delete round trip in `PublicStaging` is byte-identical. Pairing placement with `--only-missing` turned on `EnableWifiDebugging` (read back `true`), wrote 7,190-byte `PairingFile_Lockdown.plist` files into SideStore and LiveContainer + SideStore, and verified them (correct UDID and HostID, no `RootPrivateKey`); existing pairing files were left untouched.
- `PasswordProtected` read `false` on a device that **has a passcode** (confirmed by the owner) while it was unlocked: it reports the current lock state, not passcode presence. Passcode presence is detected through Wi-Fi debugging (`MissingValue` → `device.passcode_required`).
- Still to verify: SideStore actually using the new file, a new pairing (trust prompt) over USB, installs and profile writes, Windows and Linux.

## 7. Apple sign-in against real accounts (2026-10-15)

`apple-probe` with two real Apple IDs on macOS. What Apple requires today, all verified:
- **Machine identity is persistent.** A new anisette identity on every attempt gets `-90010`/`-22421` intermittently; reusing one identity (as installed clients do) is accepted.
- **hsc 434 resync.** The first `init` from a newly provisioned machine answers `ec -22421` + `hsc 434` with `X-Apple-I-MD-DATA`; resync through the same anisette server (`get_headers` with `sim`, `device_id`, `md_lu`) and send `init` again.
- **Request shape** (as config): `cpd` flags as strings, only `X-Mme-Device-Id`/`X-Apple-I-MD`/`X-Apple-I-MD-M` from anisette in `cpd`; `Accept: text/x-xml-plist`, `X-Xcode-Version` and `X-Apple-App-Info` on every GrandSlam request; endpoints from the URL bag fetched with a macOS akd identity; device id and LU lower-case.
- **TLS:** `gsa.apple.com` chains to Apple Root CA (not in public root stores); trust it explicitly, keep verification on.
- **Session data (`spd`)** decrypts to a bare `<dict>` without `<plist>` (CoreFoundation accepts that).
- **After the password**, a trusted-device account answers `hsc 409` without `au`: Apple already pushed the code; go to code entry without pushing again. Fresh one-time anisette values on every 2FA request.
- **Result:** sign-in with device 2FA and the `com.apple.gs.xcode.auth` token (valid one year) work end to end.
- **SMS 2FA is refused** (`HTTP 403` on `/auth`) for an SMS-only account; another current client gets the same 403. Reported as `apple.sms_unavailable`; not worked around.

## 8. Developer services (2026-10-15)

- The Xcode developer API (`developerservices2…/QH65B2/[ios/]<action>.action?clientId=XABBG36SBA`) works with the `com.apple.gs.xcode.auth` token in `X-Apple-GS-Token`, the adsid in `X-Apple-I-Identity-Id`, and fresh anisette `cpd` headers. Verified with a free account: `listTeams`, `listDevices`, `listAllDevelopmentCerts`, `listAppIds` (`maxQuantity` 10, `availableQuantity`, per-App-ID `expirationDate`).
- Certificates carry the creating tool's `machineName` (e.g. another sideloading tool, Xcode on a Mac), which is what the revoke picker shows.
- Some responses arrive compressed even though the request did not ask for it; the client decompresses gzip/deflate/br.

## 9. Web platform constraints

> **Not applicable since 2026-10-15:** the web version was dropped and Loadstar is desktop-only. Kept for the record.

- WebUSB works only in Chromium browsers and needs a secure context (https or localhost).
- On **Windows**, Apple's driver claims the iPhone. On **macOS**, usbmuxd holds the device. Either way, WebUSB will likely fail to claim the usbmux interface unless the driver is swapped (Windows: WinUSB via Zadig) or usbmuxd is stopped. This needs an early spike (Roadmap milestone 2).
- Apple endpoints don't send CORS headers, so the web shell needs the stateless `relay`.
- Browser memory: a single 2 GB buffer fails in Chrome; 1 GB works. Stream IPAs from `File`.

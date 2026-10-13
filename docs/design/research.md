# Research

> Findings that shaped Loadstar's design, as of 2026-10-13. Detailed references live in `docs/design/`.

## Active Summary

- A **pure-TypeScript iOS code signer is feasible and was proven** in a spike. Its output is byte-identical to Apple `codesign` and runs identically in Node 22 and Chrome 155.
- Sideloading installers typically fail in **auth (anisette)**, **hardcoded download URLs**, **signing/provisioning**, and **opaque errors**. Loadstar's architecture targets each one.
- **LiveContainer's GitHub repository is gone** (404 under both org and original owner). Release sources must be data, and their disappearance must be a handled error.
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

## 4. Web platform constraints

- WebUSB works only in Chromium browsers and needs a secure context (https or localhost).
- On **Windows**, Apple's driver claims the iPhone. On **macOS**, usbmuxd holds the device. Either way, WebUSB will likely fail to claim the usbmux interface unless the driver is swapped (Windows: WinUSB via Zadig) or usbmuxd is stopped. This needs an early spike (Roadmap milestone 2).
- Apple endpoints don't send CORS headers, so the web shell needs the stateless `relay`.
- Browser memory: a single 2 GB buffer fails in Chrome; 1 GB works. Stream IPAs from `File`.

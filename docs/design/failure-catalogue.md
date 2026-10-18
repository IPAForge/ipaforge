# Failure catalogue

> What breaks sideloading installers in practice, and what IPAForge does about each failure. Built on 2026-10-15 from about 800 public user reports against a widely used SideStore installer, plus the SideStore source and docs. The reports and their text were used as data only. No code was taken from any tool.
>
> Counts are approximate. Each entry gives what the user saw, the cause, and IPAForge's handling, with the phase that delivers it.

## 1. Clusters

| Cluster | Share of reports | Cause | IPAForge handling | Phase |
|---|---|---|---|---|
| Anisette server failures (502/400, EOF, TLS errors, timeouts, placeholder custom URLs) | ~22 % | Third-party servers down, misconfigured or rate-limited; CA path, clock skew | Remote server list + health check + automatic failover; validate custom URLs; OS trust store; clock-skew check; per-server state with reset | 3 |
| GSA `-80045`, HTTP 503/429 at the first login request | ~10 % | Apple rejects the client identity (`X-Mme-Client-Info`) or rate-limits | Apple-facing headers come from the anisette server's `/v3/client_info` or a signed remote config, never constants; backoff with jitter, fresh connections; status banner during Apple-wide incidents | 3 |
| Wrong password, locked account, `-22406`, `-22411` | ~4 % | User, account state, email casing | Trim and lowercase emails, allow phone logins; never auto-retry a wrong password; specific screens | 3 |
| 2FA (SMS 412, legacy 4-digit, security keys, `-28248`, `-21669`) | ~3 % | Incomplete 2FA flows | Full 2FA state machine (see §3) | 3 |
| Credential storage (keyring missing, size limits) | ~2 % | OS keychains have size limits and gaps | Only a master key in the OS keychain; large secrets in an encrypted file store; missing entries are normal | 3, 9 |
| Crashes during login (bad string slicing, CPU intrinsics) | ~2 % | Engine bugs | Unicode-safe string handling; WebCrypto; every error serialised with a code, no blank screens | all |
| Account or team not eligible (`1102`, `2160`, `4550`, 403 listTeams, no teams) | ~3 % | Apple account state, wrong team | Team picker remembered per Apple ID; specific screens with fix links | 3, 4 |
| Certificate limit / revoke (`7460`, `7252`, `7475`) | ~2 % | Free teams allow few certificates; other tools' certificates; wrong revoke endpoint | Reuse first (machine name + key match); revoke picker that shows the creating tool and the impact; per-type revoke; hide unrevocable; `.p12` export/import | 4, 10 |
| App ID quota (10 per 7 days), negative or missing `availableQuantity`, invalid `appIdName` (`35`), `9401` | ~5 % | Apple quota; one App ID per extension; parsing | Budget before any Apple write (main + extensions − existing); clamp negatives; show next free slot; "conserve App IDs" mode (main profile for extensions, or strip extensions); normalised ASCII names | 4, 5 |
| Free-profile 3-app limit | ~2 % | iOS counts active free-profile apps, expired ones included | Before signing, list them; let the user remove one or abort; the install error is parsed into the list | 2 ✓, 5 |
| Profile banned `0xe8008024` / identity invalid `0xe8008018` | ~7 % | Apple blocks the Apple ID's team on that device | Detect both (done in Phase 2); account health per Apple ID; one-click switch to another saved Apple ID; never burn App IDs/certificates in a retry loop | 2 ✓, 3, 5 |
| Profile/extension/Info.plist rewrite (`0xe8008015`, extension placeholders, Watch companion, BGTask IDs) | ~2 % | Signer gaps | Walk `PlugIns/`, `Extensions/`, `Watch/`; rewrite every bundle-ID-derived key; profile per appex; IPA validation before Apple calls | 5 |
| Signer and filesystem (non-BMP names in certificate/P12, Windows locks and symlink privileges, truncated zips) | ~2 % | Engine and OS | Sanitised Unicode in subjects/friendly names; per-job temp dirs; no symlinks on Windows; verify downloads | 1 ✓, 5 |
| Developer-services network errors (DNS, hotspot, filtered networks) | ~1.5 % | Network | Connectivity preflight (GSA lookup, developerservices2, anisette); hotspot detection; retries for idempotent calls | 3, 7 |
| Pairing / lockdown / house_arrest | ~12 % | No passcode, locked device, trust not accepted, network instead of USB, old Apple Mobile Device Support, cleared trusted computers, a tool's own pair record replacing the OS's in usbmuxd | Device preflight (passcode, lock, trust, Developer Mode, iOS version, USB); USB preferred; use the OS's pair record and never write to usbmuxd (own pairing only as a fallback, kept in IPAForge's secret store); Wi-Fi debugging enabled with passcode detection; per-app pairing files from a data table, verified after writing; retry once on AFC drops | 2 ✓, 7 |
| usbmuxd / device not detected (Windows driver, Linux socket activation) | ~3 % | Host OS | Per-OS checks with copyable fixes (Apple Devices app / Apple Mobile Device Service on Windows; `systemctl`/udev on Linux); one bad device never hides others | 2 ✓, 7 |
| App won't start (WebView, Wayland/EGL) | ~2 % | Shell runtime | Electron bundles Chromium; no bundled system graphics libraries; GPU fallbacks | 9 |
| Packaging (antivirus false positives, Gatekeeper) | ~2 % | Distribution | Signed + notarised builds, signed auto-update | 9, 12 |
| Download 404 (repository removed), truncated downloads | ~4 % | Hardcoded release URLs | Remote source manifest with mirrors, SHA-256 and cache; "import IPA" keeps the full automation | 5 |
| After-install problems (SideStore 1006/1414, LiveContainer certificate, LocalDevVPN, iOS-version breakage) | ~5 % | Downstream apps | On-device checklist per iOS version; "Repair SideStore" wizard; version-compatibility table (e.g. nightly for new iOS) | 8 |

## 2. Error codes

### GSA / sign-in
| Code | Meaning | Handling |
|---|---|---|
| -80045 | Client identity rejected before credentials | Refresh client info / switch anisette provider; dedicated message |
| -90010 | Same message as -80045, at `init`; first seen 2026-10-15 with a real account through a server-provided Windows iTunes identity | Treated as `apple.client_rejected` |
| -22421 (+ hsc 434) | Returned with `hsc 434` and `X-Apple-I-MD-DATA` when Apple wants an anisette resync (verified 2026-10-15) | Resync with the same anisette server (`sim`, `device_id`, `md_lu` in `get_headers`) and retry `init` once; without 434 → `apple.account_refused` |
| -20970 | "Your account information was entered incorrectly." (unknown Apple ID) | `apple.invalid_credentials` |
| -22411 | Account refused right now (new, flagged) | Wait, sign in on an Apple device once, or use another Apple ID |
| -22406 | Wrong password (or email casing) | Re-prompt; no automatic retry |
| -21669 | Wrong 2FA code | Re-prompt |
| -28248 | SMS cannot be sent to this number | Offer device 2FA or wait |
| HTTP 403 on `/auth` or `/auth/verify/phone` | Apple refuses the SMS flow for third-party clients (confirmed 2026-10-15 with two different clients on the same account) | `apple.sms_unavailable`: suggest a trusted device or another Apple ID; never retried or worked around |
| -22979 / -22981, hsc 409 without `au`, HTTP 412 with an active challenge | A code was already sent | Go to code entry |
| hsc 409 with `au = trustedDeviceSecondaryAuth` | A trusted-device code is needed, and Apple sends none until asked (Oct 2026: treating it as "already sent" left users with no code) | Ask for the push (`/auth/verify/trusteddevice`), go to code entry; **Send a new code** asks again |
| -45061 | Anisette/ADI not provisioned | Re-provision automatically |
| hsc 434 | Anisette resync required | Resync with `X-Apple-I-MD-DATA`, retry |
| HTTP 503 / 429 | Edge block / rate limit | Backoff with jitter; status banner |
| `fsaChallenge` / `keyNames` | Security-key 2FA | Unsupported; explain |
| `authType: hsa` | Legacy 2FA, 4-digit code | Legacy code path |

### Developer services
| Code | Meaning |
|---|---|
| 35 | Invalid `appIdName` (normalise to ASCII, non-empty) |
| 1100 | Session expired (re-login; check clock) |
| 1102 | Account cannot be used for development (age, terms) |
| 2160 | Email not verified |
| 4550 | Wrong team / licence agreement not accepted (team picker) |
| 5405 | Device limit reached (paid) |
| 7252 | Certificate not found for that type (revoke with the right endpoint) |
| 7460 | Maximum certificates (reuse or revoke picker) |
| 7475 | Certificate can only be revoked by Apple (hide) |
| 8220 | No devices for a profile (registration pending) |
| 9401 | App ID taken by another team |
| HTTP 403 listTeams | Account not eligible |

### Device / installd / lockdown (handled in `@ipaforge/device`)
| Code | ErrorCode |
|---|---|
| `0xe8008015` profile not found | `device.profile_not_found` |
| `0xe8008018` identity no longer valid | `device.identity_invalid` |
| `0xe8008024` profile banned | `device.profile_banned` |
| "maximum number of installed apps using a free developer profile" | `device.free_app_limit` (with the app list) |
| lockdown `PasswordProtected` | `device.locked` |
| lockdown `PairingDialogResponsePending` | `device.pairing_pending` (polled until Trust) |
| lockdown `UserDeniedPairing` | `device.pairing_denied` |
| lockdown `InvalidHostID` / `InvalidPairRecord` with the OS's record (usbmuxd) | `device.invalid_pair_record`, `data.source: "usbmuxd"`; never re-paired over: unplug, replug, unlock, tap Trust |
| lockdown `InvalidHostID` / `InvalidPairRecord` with IPAForge's own record | `device.invalid_pair_record` (re-pair once) |
| TLS handshake with lockdownd fails | `device.protocol_error` with the TLS error code and reason; not a pairing problem, never re-paired |
| `MissingValue` on `EnableWifiDebugging` | `device.passcode_required` |
| usbmuxd unreachable | `device.usbmuxd_unavailable` |

## 3. Two-factor authentication requirements (Phase 3)
- Trusted-device push; SMS with a number picker; resend; switch method.
- Code length from the server (`securityCode.length`), never fixed at 6. Legacy `hsa` 4-digit codes through the device endpoint.
- "Code already sent" states (409, 412 with an active challenge, -22979/-22981) go straight to code entry; -21669 re-prompts.
- Security-key accounts get a clear "unsupported" explanation.
- The dialog stays open with an explicit cancel; cooldown and "too many codes" are shown.

## 4. SideStore and LiveContainer integration (Phases 4–5, 8)
- **Bundle IDs:** main `<orig>.<TEAMID>`; extensions keep their suffix after the main ID. App group `group.<orig>.<TEAMID>` registered, enabled on every App ID, and listed in Info.plist `ALTAppGroups` of the main app **and every extension**.
- **LiveContainer:** `keychain-access-groups` = `<TEAMID>.com.kdt.livecontainer.shared` plus `.1` … `.127`, on the main app and the LiveProcess extension.
- **Certificate injection:** `ALTCertificate.p12` (certificate + key, password = the certificate's `machineId`) at the SideStore bundle root plus Info.plist `ALTCertificateID` = serial. For LiveContainer + SideStore, into the SideStore framework bundle inside `LiveContainer.app/Frameworks` (believed to be `SideStoreApp.framework`, not yet confirmed on a device, so it is also matched by a bundle ID starting with `com.SideStore.SideStore`). The `.p12` must use the legacy PKCS#12 profile (3DES key and certificate bags, HMAC-SHA1 MAC, 2048 iterations) or iOS refuses it. Without a `machineId` there is no password, so the injection fails rather than writing an unopenable file. Implemented as a signer `additions` hook (`packages/installer/src/sidestore/`). The bundle ID alone never justifies sharing the private key, since any IPA can claim it: the caller passes a `CertificateTrust`, either a catalog release whose SHA-256 matched or the user's explicit approval for a manually imported IPA. StikStore: `Certificate.p12` + `MachineID`.
- **Pairing files:** see `packages/device/src/domain/pairing-apps.ts` (SideStore `PairingFile_Lockdown.plist` + legacy `ALTPairingFile.mobiledevicepairing`; LiveContainer `SideStore/Documents/…`; StikDebug/StikStore `pairingFile.plist`). The file must be the complete pair record: current SideStore rejects one without `RootPrivateKey` or `WiFiMACAddress` and its device connection never starts. Remote pairing (`PairingFile_RemoteRP.plist`, iOS 17.4+) in Phase 11.
- **Special-app detection** by original bundle ID: `com.SideStore.SideStore`, `com.kdt.livecontainer` (with the SideStore framework → LiveContainer + SideStore), `app.stik.store`, `com.rileytestut.AltStore`. Manually imported IPAs get the same handling, except that certificate injection needs the user's explicit approval.
- **Sources and deep links:** SideStore keeps its sources in its own database, which isn't reachable over USB, so IPAForge offers them as deep links and a QR code (`sidestore://source?url=…`; also `install?url=`, `pairing?urlname=`, `certificate?callback_template=`). An upstream "preload manifest" is the long-term fix (Phase 12). SideStore's default anisette server comes from its `ALTAnisetteURL` Info.plist key, its server list from `https://servers.sidestore.io/servers.json`.
- **LocalDevVPN** cannot be sideloaded (App Store entitlements); IPAForge links to the App Store. Default SideStore device IP `10.7.0.1`.
- **Repair SideStore** wizard: reset pairing in SideStore → re-pair → place in all apps → refresh → device IP `10.7.0.1` → change anisette server → reboot.

## 5. Top requirements by phase
- **Phase 2 (device), done:** USB preferred; passcode/lock/trust/Developer Mode detection; Wi-Fi debugging; per-app pairing files with verification; install failure classification; misagent profile cleanup.
- **Phase 3 (Apple account):** remotely updatable client identity and anisette layer with failover; 2FA state machine; retry policy; clock-skew and connectivity preflight; multi-account with health/ban flags; safe secret storage.
- **Phase 4 (developer services):** team picker; certificate lifecycle (reuse, revoke picker, per-type revoke, `.p12` export/import with `machineId` password); App ID budgeting with clamping and next-slot dates; normalised names; defensive parsing.
- **Phase 5 (installer + catalog):** remote source manifest with mirrors and hashes; IPA validation before Apple calls; signer reconciliation for `Extensions/`, `Watch/`, WK companion, BGTask, app/keychain groups, `ALTAppGroups`; SideStore/LiveContainer certificate injection; free-app-limit resolution; conserve-App-IDs mode.
- **Phase 7 (onboarding):** per-OS driver checks with copyable fixes; device preflight wizard; network preflight.
- **Phase 8 (install UX):** recovery screen per ErrorCode with "copy diagnostics"; on-device checklist per iOS version; Repair SideStore wizard; one-click account switch on bans.
- **Phase 9/12:** signed and notarised builds, signed auto-update.

[← Code Signing](signing.md) · [Back to README](../README.md) · [Apple Account →](apple-account.md)

# Talking to the Device

`@ipaforge/device` installs apps, manages provisioning profiles and places pairing files on an iPhone or iPad. It never drives USB itself: it talks to the operating system's **usbmuxd**, which already owns the device, so it works next to Finder, Apple Devices and iTunes.

| OS | How IPAForge reaches the device | If it's missing |
|---|---|---|
| macOS | `/var/run/usbmuxd` (part of macOS) | Reconnect the device |
| Windows | `127.0.0.1:27015` (Apple Mobile Device Service) | Install **Apple Devices** from the Microsoft Store, or iTunes from Apple |
| Linux | `/var/run/usbmuxd` (`usbmuxd` package) | Install `usbmuxd`; it starts when a device is plugged in (`sudo systemctl restart usbmuxd`) |

`USBMUXD_SOCKET_ADDRESS` (`UNIX:/path` or `host:port`) overrides the endpoint, as with libimobiledevice tools.

## Pairing and trust

IPAForge uses the pairing the operating system already made. When the user taps **Trust This Computer?**, the OS creates a pair record and keeps it in usbmuxd: macOS always does, Windows does with Apple Devices or iTunes installed, and on Linux `usbmuxd` pairs when the device is plugged in.

- If the computer already trusts the device (it shows up in Finder or Apple Devices), IPAForge reads that pair record from usbmuxd and uses it.
- Otherwise IPAForge waits for it. The user unlocks the device and taps Trust, and IPAForge checks usbmuxd every second until the OS's record appears (up to 1 minute by default, `osPairingTimeoutMs`).
- Only if no record appears in that time does IPAForge pair on its own: it sends lockdown `Pair` with certificates it generates, the device asks for Trust again, and IPAForge waits up to 2 minutes (`pairingTimeoutMs`). That record is kept in IPAForge's secret store only. Callers can also ask for this directly (`method: "own"`).
- **IPAForge never writes to usbmuxd.** It does not save, replace or delete the OS's pair record, so Finder, Apple Devices and other tools keep working.
- If the device rejects the OS's record (for example after **Reset Location & Privacy** or **Clear Trusted Computers**), IPAForge does not pair over it. It fails with `device.invalid_pair_record`: unplug the device, plug it back in, unlock it and tap Trust, so the OS pairs again. If the device rejects a record IPAForge made itself, IPAForge pairs again once.
- Every session is TLS-encrypted. The device is authenticated by **pinning**: it must present exactly the device certificate from the pair record. A failed TLS handshake is reported as `device.protocol_error` with the TLS details; it does not mean the pairing is wrong, so it never triggers pairing. The certificates in a pair record are SHA-1 with empty subject and issuer names, which OpenSSL refuses at its default security level, so device connections (and only those) run at `@SECLEVEL=0`; the pinning is what authenticates the device.

## What it can do

| Capability | Service |
|---|---|
| Device identity, iOS version, passcode, Developer Mode, activation | lockdownd, AMFI |
| Reveal the Developer Mode toggle in Settings (never enables it silently) | `com.apple.amfi.lockdown` |
| Install (with progress: bytes sent while uploading, then installd's percent and phase), upgrade, uninstall, list apps | AFC upload to `PublicStaging` + `installation_proxy` |
| List, install and remove provisioning profiles; remove expired ones and ones for apps that are gone | `misagent` |
| Read and write files in an app's container or Documents folder | `house_arrest` + AFC |
| Place the pairing file into SideStore, LiveContainer + SideStore, StikDebug, StikStore | `house_arrest` + AFC, after enabling Wi-Fi debugging |

### Pairing files

On-device tools such as SideStore and StikDebug use a copy of this computer's pairing to talk to the device over Wi-Fi/VPN. IPAForge:
1. turns on Wi-Fi debugging (this needs a **passcode** on the device);
2. finds the pairing apps installed by **your own** Apple IDs. App names and file locations are data in `packages/device/src/domain/pairing-apps.ts`;
3. shows the targets for confirmation. The file grants access to the device, so it is never written anywhere implicitly;
4. writes every file name each app reads, then checks the size that landed.

The pairing file is the whole pair record plus the device UDID, including the root private key and the Wi-Fi MAC address (read from the device when the record lacks it). On-device tools refuse a file without them: SideStore fails to start its device connection ("devicegateway not initialized").

### Remote pairing (iOS 17.4 and later)

iOS 17.4 added a second kind of pairing, remote pairing, which newer SideStore builds can use instead of the classic one. On iOS 17.4 and later, placing the pairing file also gives SideStore its remote pairing:
- **Made over USB once per device**, through the lockdown service `com.apple.dt.remotepairingdeviced.lockdown` that the classic pairing opens (messages are JSON framed with `RPPairing` and a 2-byte big-endian length). Pair-setup is SRP-6a (3072-bit group, SHA-512) with the fixed USB PIN, then this computer's and the device's Ed25519 identities are exchanged under ChaCha20-Poly1305. The device's signature is checked. The device may show the Trust prompt.
- **Kept per device**, encrypted with the other secrets (`remote-pairing/<udid>`): this computer's Ed25519 key pair and identifier, the device's identifier and public key, and its identity resolving key. Before it's reused, a pair-verify (X25519, both sides signing) checks the device still accepts it. A device that refuses it (its Trust was reset) gets a new one.
- **Its own file:** `PairingFile_RemoteRP.plist` in SideStore's `Documents` (also for the SideStore inside LiveContainer), holding only `public_key`, `private_key`, `identifier` and `alt_irk`. SideStore treats a file with both the classic and the remote keys as ambiguous, so the classic pairing stays in its own files.
- **Optional by design:** if making it fails, the classic pairing is still placed (SideStore works with it alone), and a warning is logged. SideStore builds from September 20, 2026 onwards read the remote file; older ones ignore it. Those newer builds also ask, once, which protocol to prefer (Settings → Advanced → Pairing File Management), because a file placed from outside doesn't set that choice inside SideStore.

### Pairing files per app

**Apps › Pairing files** shows every pairing app and every other app IPAForge installed on the device, with whose pairing files each holds (`engine.pairingFiles`): this computer's (the file's `HostID` is this computer's), another computer's, or none, and, on iOS 17.4 and later, whether SideStore's remote file is this computer's and still accepted.
- **Place** writes this computer's files into one app (`engine.placeAppPairing`): a known app at the paths it reads (SideStore's remote file too), an app of your own at the path you give. That path must be under the app's `Documents/` or `Library/`, end in `.plist` or `.mobiledevicepairing`, and contain no `..`; it is remembered per device and app (`pairing-paths/<udid>`), and the old file is removed when the path changes. Apps other tools installed are never offered.
- **Remove** deletes an app's files (`engine.removeAppPairing`; `handle.removeAppFile`): the app can't reach the device by itself until a file is placed again.
- **New remote pairing** makes a new one even when the saved one is still accepted (`newRemotePairing: true` on `placePairingFile`), and places it, with the classic file, in every app that reads one. The old one stops working.
- **Save pairing file…** on the Devices page saves this computer's file (`handle.pairingFileData`, `engine.devicePairingFile`) as `<UDID>.mobiledevicepairing`, for another tool that asks for one.

## Errors you may see

| Code | Meaning | What to do |
|---|---|---|
| `device.usbmuxd_unavailable` | usbmuxd/Apple Mobile Device Service isn't running | See the table at the top |
| `device.not_found` | The device was unplugged or isn't visible | Reconnect; try another cable or port |
| `device.pairing_path_invalid` | A path given for a pairing file isn't under the app's Documents or Library, or doesn't end in `.plist` or `.mobiledevicepairing` | Use the path from the app's instructions |
| `device.locked` / `device.pairing_pending` | Waiting for unlock / Trust | Unlock the device and tap Trust |
| `device.pairing_denied` | Don't Trust was tapped | Unplug, replug, tap Trust |
| `device.timeout` | Nobody answered the trust prompt | Try again with the device unlocked |
| `device.invalid_pair_record` | The device rejected this computer's pairing | Unplug, plug back in, unlock and tap Trust |
| `device.protocol_error` | The device broke the protocol, for example a failed TLS handshake | Reconnect; the details name the TLS error |
| `device.passcode_required` | Wi-Fi debugging needs a passcode | Set a passcode in Settings › Face ID & Passcode |
| `device.developer_mode_off` | iOS 16+ without Developer Mode | Settings › Privacy & Security › Developer Mode, then restart |
| `device.free_app_limit` | 3 active free-profile apps per device | Remove one of the listed apps (expired ones count) |
| `device.profile_banned` (`0xe8008024`) | Apple blocked this Apple ID's team for sideloading on this device | Use another Apple ID |
| `device.identity_invalid` (`0xe8008018`) | The signing certificate was revoked or is no longer valid | Sign again with a valid certificate; check the computer's clock |
| `device.profile_not_found` (`0xe8008015`) | A bundle has no matching profile, or the device registration is still pending | Retry later; re-provision |
| `device.install_failed` | Any other installd error; its name is in the details | See the details |

## For contributors

```bash
pnpm --filter @ipaforge/desktop device-probe list              # devices visible to usbmuxd
pnpm --filter @ipaforge/desktop device-probe info              # identity and checks (read-only)
pnpm --filter @ipaforge/desktop device-probe pair [--own]      # wait for the OS pairing (tap Trust); --own pairs with IPAForge's own record
pnpm --filter @ipaforge/desktop device-probe apps | profiles   # read-only
pnpm --filter @ipaforge/desktop device-probe pairing-status <TEAMID...>   # classic and remote pairing files (read-only)
pnpm --filter @ipaforge/desktop device-probe rp-pair            # iOS 17.4+: makes a remote pairing, then verifies it (kept in memory only)
pnpm --filter @ipaforge/desktop device-probe afc-speed [--mb 32]   # times AFC writes per chunk size (written, then deleted)
IPAFORGE_DEVICE=1 pnpm vitest run apps/desktop/src/main/adapters/device.hardware.test.ts
```

Unit tests run against an in-memory fake device (`packages/device/src/__tests__/fake-device/`), which simulates usbmuxd, lockdownd and every service, so CI needs no hardware.

## See Also

- [Architecture](architecture.md): ports and adapters
- [Code Signing](signing.md): what gets installed
- Failure catalogue: `docs/design/failure-catalogue.md`

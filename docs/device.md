[← Code Signing](signing.md) · [Back to README](../README.md) · [Apple Account →](apple-account.md)

# Talking to the Device

`@loadstar/device` installs apps, manages provisioning profiles and places pairing files on an iPhone or iPad. It never drives USB itself: it talks to the operating system's **usbmuxd**, which already owns the device, so it works next to Finder, Apple Devices and iTunes.

| OS | How Loadstar reaches the device | If it's missing |
|---|---|---|
| macOS | `/var/run/usbmuxd` (part of macOS) | Reconnect the device |
| Windows | `127.0.0.1:27015` (Apple Mobile Device Service) | Install **Apple Devices** from the Microsoft Store, or iTunes from Apple |
| Linux | `/var/run/usbmuxd` (`usbmuxd` package) | Install `usbmuxd`; it starts when a device is plugged in (`sudo systemctl restart usbmuxd`) |

`USBMUXD_SOCKET_ADDRESS` (`UNIX:/path` or `host:port`) overrides the endpoint, as with libimobiledevice tools.

## Pairing and trust

Loadstar uses the pairing the operating system already made. When the user taps **Trust This Computer?**, the OS creates a pair record and keeps it in usbmuxd: macOS always does, Windows does with Apple Devices or iTunes installed, and on Linux `usbmuxd` pairs when the device is plugged in.

- If the computer already trusts the device (it shows up in Finder or Apple Devices), Loadstar reads that pair record from usbmuxd and uses it.
- Otherwise Loadstar waits for it. The user unlocks the device and taps Trust, and Loadstar checks usbmuxd every second until the OS's record appears (up to 1 minute by default, `osPairingTimeoutMs`).
- Only if no record appears in that time does Loadstar pair on its own: it sends lockdown `Pair` with certificates it generates, the device asks for Trust again, and Loadstar waits up to 2 minutes (`pairingTimeoutMs`). That record is kept in Loadstar's secret store only. Callers can also ask for this directly (`method: "own"`).
- **Loadstar never writes to usbmuxd.** It does not save, replace or delete the OS's pair record, so Finder, Apple Devices and other tools keep working.
- If the device rejects the OS's record (for example after **Reset Location & Privacy** or **Clear Trusted Computers**), Loadstar does not pair over it. It fails with `device.invalid_pair_record`: unplug the device, plug it back in, unlock it and tap Trust, so the OS pairs again. If the device rejects a record Loadstar made itself, Loadstar pairs again once.
- Every session is TLS-encrypted. The device is authenticated by **pinning**: it must present exactly the device certificate from the pair record. A failed TLS handshake is reported as `device.protocol_error` with the TLS details; it does not mean the pairing is wrong, so it never triggers pairing.

## What it can do

| Capability | Service |
|---|---|
| Device identity, iOS version, passcode, Developer Mode, activation | lockdownd, AMFI |
| Reveal the Developer Mode toggle in Settings (never enables it silently) | `com.apple.amfi.lockdown` |
| Install (with progress), upgrade, uninstall, list apps | AFC upload to `PublicStaging` + `installation_proxy` |
| List, install and remove provisioning profiles; remove expired ones and ones for apps that are gone | `misagent` |
| Read and write files in an app's container or Documents folder | `house_arrest` + AFC |
| Place the pairing file into SideStore, LiveContainer + SideStore, StikDebug, StikStore | `house_arrest` + AFC, after enabling Wi-Fi debugging |

### Pairing files

On-device tools such as SideStore and StikDebug use a copy of this computer's pairing to talk to the device over Wi-Fi/VPN. Loadstar:
1. turns on Wi-Fi debugging (this needs a **passcode** on the device);
2. finds the pairing apps installed by **your own** Apple IDs. App names and file locations are data in `packages/device/src/domain/pairing-apps.ts`;
3. shows the targets for confirmation. The file grants access to the device, so it is never written anywhere implicitly;
4. writes every file name each app reads, then checks the size that landed.

The pairing file leaves out the root private key, which apps never need.

## Errors you may see

| Code | Meaning | What to do |
|---|---|---|
| `device.usbmuxd_unavailable` | usbmuxd/Apple Mobile Device Service isn't running | See the table at the top |
| `device.not_found` | The device was unplugged or isn't visible | Reconnect; try another cable or port |
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
pnpm --filter @loadstar/desktop device-probe list              # devices visible to usbmuxd
pnpm --filter @loadstar/desktop device-probe info              # identity and checks (read-only)
pnpm --filter @loadstar/desktop device-probe pair [--own]      # wait for the OS pairing (tap Trust); --own pairs with Loadstar's own record
pnpm --filter @loadstar/desktop device-probe apps | profiles   # read-only
pnpm --filter @loadstar/desktop device-probe pairing-status <TEAMID...>
LOADSTAR_DEVICE=1 pnpm vitest run apps/desktop/src/main/adapters/device.hardware.test.ts
```

Unit tests run against an in-memory fake device (`packages/device/src/__tests__/fake-device/`), which simulates usbmuxd, lockdownd and every service, so CI needs no hardware.

## See Also

- [Architecture](architecture.md): ports and adapters
- [Code Signing](signing.md): what gets installed
- Failure catalogue: `docs/design/failure-catalogue.md`

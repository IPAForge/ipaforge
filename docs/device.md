[← Code Signing](signing.md) · [Back to README](../README.md) · [Apple Account →](apple-account.md)

# Talking to the Device

`@ipaforge/device` installs apps, manages provisioning profiles and places pairing files on an iPhone or iPad. It never drives USB itself: it talks to the operating system's **usbmuxd**, which already owns the device, so it works next to Finder, Apple Devices and iTunes. On Wi-Fi it can also reach a device it knows directly, without usbmuxd (see [Wi-Fi without usbmuxd](#wi-fi-without-usbmuxd)). On iOS 17.4 and later it can also open the device's own tunnel (see [The device tunnel](#the-device-tunnel-ios-174-and-later)).

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

## Wi-Fi without usbmuxd

A device this computer has opened before can be reached on the same Wi-Fi network without usbmuxd. This works on Linux without usbmuxd installed, and where Apple's own Wi-Fi discovery doesn't list the device.

- **Wi-Fi is turned on by itself.** Whenever a session opens, by cable or over Wi-Fi, IPAForge reads the device's `EnableWifiConnections` (lockdown domain `com.apple.mobile.wireless_lockdown`, the same setting as Finder's *Show this iPhone when on Wi-Fi*) and turns it on if it is off. It logs when it does. Hosts can turn this off with `enableWifiConnections: false`. A failure here never fails the session.
- **The device is remembered:** its UDID and its real Wi-Fi MAC address (lockdown `WiFiAddress`), in the secret store under `wifi-devices`.
- **Finding it:** IPAForge asks for `_apple-mobdev2._tcp.local` (mDNS) every 10 seconds, from a UDP port of its own, so devices answer straight back to it (RFC 6762 §6.7). It never binds 5353, so it doesn't compete with Bonjour or avahi. Each query goes out of every IPv4 interface. One answer carries the advert's name (`<MAC>@<IPv6>-supportsRP-NN`), its TXT values and the device's IPv4 address.
- **Telling devices apart:** with Private Wi-Fi Address, the MAC in the advert changes on every network. So on iOS 26.4 and later IPAForge checks the advert's tags against each known device's pair record (one per paired computer: `authTag`, then `authTag#1`, `authTag#2`…): it must equal the first 8 bytes of HMAC-SHA256(key, `identifier`), the key being HKDF-SHA512 of the pair record's HostID (no salt, no info, 32 bytes), checked against a real iPhone on iOS 26.6.1. Otherwise (an advert without tags) it compares the MAC in the advert's name with the remembered one; a signed advert with no tag of ours is never matched by its MAC. Adverts of devices this computer isn't paired with are ignored. A tag must be exactly 8 bytes (compared in constant time, at most 4 per advert), so a short forged one can't match. Matching only decides where to connect: the device is authenticated as on USB, by the TLS pin to the pair record's device certificate, so an advert that lies leads to a failed session, never to an install.
- **Connecting:** lockdown on TCP port 62078 straight at the device's address, with the same pair record and TLS, then every service on the port lockdown starts. Without usbmuxd, IPAForge's own pair record is used (a device paired by the OS needs its usbmuxd record, so it needs usbmuxd).
- **Which link is used:** USB first, then straight over Wi-Fi (through the tunnel on iOS 17 and later, see [A session inside the tunnel](#the-tunnel-over-wi-fi-ios-174-and-later)), then usbmuxd's own Wi-Fi link. Straight over Wi-Fi measured 16-18 MiB/s against 6.4 MiB/s for usbmuxd's link, and ~37 MiB/s over USB.
- A device is gone after a goodbye from it, or when it hasn't answered for three rounds.
- **macOS asks first.** The first search shows "find devices on your local network" (the reason is in the app's Info.plist, translated). If it's refused, sends fail with "no route to host", which IPAForge reports as `device.local_network_denied`, and the Devices page explains how to allow it. Devices on a cable still work.

## The device tunnel (iOS 17.4 and later)

From iOS 17.4 a device offers a second way to its services: a packet tunnel, the way Xcode reaches it. Installs don't need it, so they still go the classic way, lockdown `StartService` on the session's link, which works on every iOS. The tunnel is used when lockdown won't start a service: IPAForge then opens it once for the session and reaches that service through it. Maintainer tools can also send every service through it (`route: "tunnel"`).

- **Opening it:** lockdown starts `com.apple.internal.devicecompute.CoreDeviceProxy` over the session's link (TLS with the pair record, as for any service). A `CDTunnel` handshake (the ASCII magic, a 2-byte big-endian length, JSON) asks for an MTU and gets both tunnel addresses, the agreed MTU and the port of the device's service discovery (RSD). They're new for every tunnel and never stored. Before iOS 17.4 the service doesn't exist: `device.tunnel_unavailable`.
- **No network interface, no admin rights:** after the handshake the connection carries raw IPv6 packets, and IPAForge runs its own TCP client over them, in TypeScript, in `packages/device`. Client connections only, to one peer. Window scaling both ways, sending limited by the device's window, every in-order segment acknowledged at once, and simple loss recovery: a retransmission timer with back-off, fast retransmit on three duplicate ACKs, and a retransmit on every partial ACK until the loss is repaired. A retransmission goes out ahead of the packets still waiting to be written, so a full window queued behind it can't delay it past the next timeout. A connection that gets no ACK through 8 timeouts in a row fails with `device.timeout`, unless the device keeps answering with a closed window.
- **Two rules from measuring a real iPhone (iOS 26.6.1, USB):**
  1. **One packet per write, one write at a time.** When writes are left pending, the TLS socket under the tunnel bundles them into one TLS record of up to 16 KB, and the device loses packets from bundled records, at any rate. Serialized, a 100 MiB upload ran at 34 MiB/s with no retransmission, against ~35.5 MiB/s for the classic path.
  2. **Packets to the device stay under 8 KB.** Larger ones stall the connection, whatever MTU the tunnel agreed. IPAForge asks for MTU 8000 and never sends a larger packet (`tunnelMtu`): 1500 gave 29.8 MiB/s, 6000 33.7, 8000 34.2.
- **Finding services:** RSD speaks RemoteXPC, binary XPC objects carried in a minimal HTTP/2 (empty header blocks, no HPACK). The client opens the root and reply streams, then sends its own `Handshake` right away: current iOS sends its service map only in answer to one. The first message on the root stream must be an empty dictionary flagged exactly `AlwaysSet` (with `DataPresent` added the device goes silent). The answer lists every service with its port, and the device's properties; a tunnel that answers with another device's UDID is refused.
- **Services:** each lockdown service has a counterpart in the tunnel, `<service>.shim.remote` (`com.apple.afc.shim.remote`, `com.apple.mobile.installation_proxy.shim.remote`, house_arrest, misagent, amfi). A connection to one starts with `RSDCheckin` (answered with `RSDCheckin`, then `StartService`) and then speaks the service's usual protocol without TLS, because the tunnel is already encrypted. AFC, installation_proxy and the rest run unchanged on top. A signed SideStore installed this way, tunnel only, in 2.1 s.
- The tunnel closes with the session.

## The tunnel over Wi-Fi (iOS 17.4 and later)

With the remote pairing made over USB ([Remote pairing](#remote-pairing-ios-174-and-later)), IPAForge can open the iOS 17+ CoreDevice tunnel to a device on Wi-Fi (`DeviceManager.openWifiTunnel`, the probe `rp-tunnel`). No Wi-Fi sync or admin rights are needed.

1. **Find the remote pairing port:** the device's `_remotepairing._tcp` advert at its Wi-Fi address (port 49152 on the iPhones tested).
2. **Pair-verify** over that TCP connection with the saved identity. It gives a shared X25519 secret.
3. **An encrypted `createListener`** for a TCP tunnel. After pair-verify, messages are `streamEncrypted`: ChaCha20-Poly1305 under HKDF-SHA512 keys (`ClientEncrypt-main` from us, `ServerEncrypt-main` from the device), the nonce being each direction's message count as 8 little-endian bytes then 4 zero bytes. The device answers with the port of the tunnel.
4. **TLS 1.2 PSK** to that port, keyed with the pair-verify secret, empty identity. iOS refuses every SHA-1 and ECDHE-PSK cipher suite, which are all Electron's TLS library has, so IPAForge uses its own TLS 1.2 PSK client (`infrastructure/tls-psk`) with `TLS_PSK_WITH_AES_128_GCM_SHA256` and the extended master secret. It is tested against OpenSSL's server.
5. **The CDTunnel handshake** over the TLS connection, the same as over USB. It returns the device's address in the tunnel, ours with the netmask and MTU, and RemoteServiceDiscovery's port. The control connection stays open for the tunnel's life.

Inside, the tunnel is the same as over USB: IPAForge's TCP client, RSD and the services (`DeviceTunnel`). The control connection closes with the tunnel. Measured on an iPhone on iOS 26.6.1: the tunnel and RSD in about 3.3 s, 73 services, an AFC upload of 20 MiB at 9.3 MiB/s with no retransmissions. 
**A session inside the tunnel.** A device session can run entirely inside the Wi-Fi tunnel (`open(udid, { route: 'wifi-tunnel' })`): lockdown is the tunnel's own, `com.apple.mobile.lockdown.remote.trusted`, trusted once checked in (no `StartSession`, no TLS of ours), and every service is its counterpart in the tunnel (`*.shim.remote`). So everything a session does (installs, profiles, app files) works through it. By default IPAForge prefers USB. A device on Wi-Fi with a remote pairing is opened through this tunnel first, and by lockdown straight over Wi-Fi only if the tunnel doesn't open: on iOS 17 and later lockdown there answers, but the device closes every service it starts (checked on an iPhone on iOS 26.6.1, from Windows: `info` works, installation_proxy, misagent and AFC close at once), so installs over Wi-Fi need the tunnel. A device without a remote pairing goes by lockdown, and when that doesn't answer and it has one, the tunnel is still tried before giving up (the first error is kept if that fails too). `route: 'wifi'` is lockdown only.

**The remote pairing is made by cable.** Whenever a session opens over USB on iOS 17.4 or later and no remote pairing is saved, IPAForge makes one (`makeRemotePairing`, on by default), so the device works on Wi-Fi once the cable is out. It needs no Trust: the classic pairing already counts. A device that would ask the user first is left alone, and a failure here is logged and never fails the session.

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
| `device.timeout` | Nobody answered the trust prompt, or the device stopped answering while it installed (it said nothing for 90 seconds: it usually locked) | Unlock the device and try again |
| `device.invalid_pair_record` | The device rejected this computer's pairing | Unplug, plug back in, unlock and tap Trust |
| `device.protocol_error` | The device broke the protocol, for example a failed TLS handshake | Reconnect; the details name the TLS error |
| `device.passcode_required` | Wi-Fi debugging needs a passcode | Set a passcode in Settings › Face ID & Passcode |
| `device.developer_mode_off` | iOS 16+ without Developer Mode | Settings › Privacy & Security › Developer Mode, then restart |
| `device.free_app_limit` | 3 active free-profile apps per device | Remove one of the listed apps (expired ones count) |
| `device.profile_banned` (`0xe8008024`) | Apple blocked this Apple ID's team for sideloading on this device | Use another Apple ID |
| `device.identity_invalid` (`0xe8008018`) | The signing certificate was revoked or is no longer valid | Sign again with a valid certificate; check the computer's clock |
| `device.profile_not_found` (`0xe8008015`) | A bundle has no matching profile, or the device registration is still pending | Retry later; re-provision |
| `device.install_failed` | Any other installd error; its name is in the details | See the details |
| `device.local_network_denied` | macOS refused IPAForge local network access, so devices on Wi-Fi can't be found | System Settings › Privacy & Security › Local Network › IPAForge; or use a cable |
| `device.tunnel_unavailable` | The device didn't open its tunnel (it runs an iOS before 17.4, or refused CoreDeviceProxy) | Update the device to iOS 17.4 or later; reconnect it |

## For contributors

```bash
pnpm --filter @ipaforge/desktop device-probe list              # devices visible to usbmuxd
pnpm --filter @ipaforge/desktop device-probe info              # identity and checks (read-only)
pnpm --filter @ipaforge/desktop device-probe pair [--own]      # wait for the OS pairing (tap Trust); --own pairs with IPAForge's own record
pnpm --filter @ipaforge/desktop device-probe apps | profiles   # read-only
pnpm --filter @ipaforge/desktop device-probe pairing-status <TEAMID...>   # classic and remote pairing files (read-only)
pnpm --filter @ipaforge/desktop device-probe rp-pair            # iOS 17.4+: makes a remote pairing, then verifies it (kept in memory only)
pnpm --filter @ipaforge/desktop device-probe afc-speed [--mb 32]   # times AFC writes per chunk size (written, then deleted)
pnpm --filter @ipaforge/desktop device-probe wifi-list [--udid <udid>]   # finds known devices on Wi-Fi, without usbmuxd
pnpm --filter @ipaforge/desktop device-probe rp-tunnel [--mb 20]   # iOS 17.4+: the tunnel over Wi-Fi, and an upload through it
pnpm --filter @ipaforge/desktop device-probe install <signed.ipa> --wifi-tunnel   # any device command, in a session inside the Wi-Fi tunnel
pnpm --filter @ipaforge/desktop device-probe info --direct [--udid <udid>]   # any device command, straight over Wi-Fi only
pnpm --filter @ipaforge/desktop device-probe rsd-services       # iOS 17.4+: the device's properties and services inside its tunnel
pnpm --filter @ipaforge/desktop device-probe tunnel-install [<signed.ipa>] [--mb 100] [--compare]   # a timed upload and install through the tunnel
pnpm --filter @ipaforge/desktop device-probe apps --tunnel      # any device command, with every service through the tunnel
IPAFORGE_DEVICE=1 pnpm vitest run apps/desktop/src/main/adapters/device.hardware.test.ts
```

Unit tests run against an in-memory fake device (`packages/device/src/__tests__/fake-device/`), which simulates usbmuxd, lockdownd and every service, a fake Wi-Fi (direct TCP and mDNS answers) and a fake device tunnel (`__tests__/fake-tunnel/`: CDTunnel, a TCP peer written apart from the client that can drop, duplicate or hold back segments and close its window, RSD and the shims), so CI needs no hardware.

## See Also

- [Architecture](architecture.md): ports and adapters
- [Code Signing](signing.md): what gets installed
- Failure catalogue: `docs/design/failure-catalogue.md`

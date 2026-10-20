[← Apple Account](apple-account.md) · [Back to README](../README.md) · [Engine RPC →](rpc.md)

# Install Flows

`@ipaforge/installer` puts the other packages together. Each flow is a pipeline: an ordered list of steps over one shared state, with progress, cancellation, retries for read-only steps and resume from a checkpoint. The UI (and the `install-probe` maintainer tool) talk to it only through the Engine facade, `createEngine()` in `packages/installer/src/engine.ts`.

## The flows

### Install SideStore

Installs SideStore, or LiveContainer with SideStore inside, from the catalog. The steps:

| # | Step | What it does |
|---|---|---|
| 1 | `device` | Opens the device and stops at once if it is locked, Developer Mode is off, or it does not trust this computer |
| 2 | `resolve-0` | Picks the release: the channel you asked for, or the one recommended for your iOS version |
| 3 | `download-0` | Downloads it into the cache and checks its SHA-256 |
| 4 | `inspect-0` | Reads the IPA (structure, extensions, encryption) and checks the device can run it (minimum iOS, iPhone/iPad family, 64-bit slice) before anything is sent to Apple |
| 5 | `sign-in` | Opens the saved Apple account; asks for the password or a 2FA code only when Apple wants them |
| 6 | `team` | Uses the requested team, the one remembered for the account, or the only one; otherwise asks |
| 7 | `register-device` | Registers the device with the team if it is not registered yet; Apple answering `addDevice` with resultCode 35 (already on the team, though not listed) counts as registered |
| 8 | `certificate` | Reuses the stored certificate; otherwise creates one. When the team has no room, asks which certificate to revoke |
| 9 | `app-ids` | Plans the new bundle IDs and checks the App ID budget. If it does not fit, the flow stops with the date the next slot frees up |
| 10 | `free-apps-0` | Free teams only: makes room under the free-app limit (see below) |
| 11 | `provision-0` | Creates the App IDs and app group, and downloads the profiles |
| 12 | `sign-0` | Signs the app and puts the signing certificate into SideStore (`ALTCertificate.p12`) |
| 13 | `install-0` | Installs it with progress |
| 14 | `pairing` | Places this computer's pairing file into the installed app (for LiveContainer, into the SideStore inside it), and on iOS 17.4 and later its remote pairing file next to it (`detail.remote`) |
| 15 | `remember` | Remembers the team for the account |

A new certificate is stored with its private key, per account and team, as soon as Apple issues it. The key never appears in the flow's state or checkpoint.

### Install apps

Installs one or more IPAs, from the catalog, from files or from links (an app source's apps are added by their download link), one after another (the Preload page). All apps are downloaded and inspected first, each checked against the device (minimum iOS, device family, architecture), so an app the device cannot run stops the run before any Apple call. The account steps then run once (sign-in, team, device, certificate) and check the App ID budget for all apps together. After that, each app goes through `free-apps`, `provision`, `sign` and `install`. When the list holds SideStore from the catalog (on its own or in LiveContainer), the run ends with the `pairing` step as Install SideStore does, so it gets this computer's pairing file too. Each app's steps carry its place in the list (`inspect-0`, `install-1`), which the UI groups them by.

The signing certificate goes only into an app IPAForge has a reason to trust:

- a catalog release whose download matched its published SHA-256;
- a file you picked, only after you agree. If the IPA really contains SideStore (checked from its bundles, never from the bundle ID alone), IPAForge asks before sharing the certificate and its private key. If you decline, the app is installed without it.

### Installed apps and Refresh

After each app is installed, the Engine remembers it (`InstalledStore`, desktop: `<dataDir>/installed.json`): its installed and original bundle ids, name and version, where it came from (a catalog app, a link or a file) and the certificate trust it had. It keeps the app's original IPA too (`KeptIpaStore`, desktop: `<dataDir>/kept`), one per app and device.

- `installedApps({ udid, teamIds })` reads the device: each profile signed by one of the teams names its app and expiry, installation_proxy says which of those apps are installed, and a record whose app is gone is forgotten with its IPA. Apps without a record were installed by another tool.
- **The IPAForge mark.** Signing adds an `IPAForge` dictionary to the app's `Info.plist`: `Version`, `OriginalBundleID`, `Origin` (catalog app, link or file name) and `CertificateSerial`, the certificate that signed it. installation_proxy returns it with the app, so another computer signed in with the same Apple ID recognises the app as IPAForge's, knows where to install it again from, and which certificate it depends on.
- **`refreshPlan({ udid, accountId, teamId?, bundleIds })`** decides, per app, how Refresh treats it. While the certificate in the app's mark is still valid for the team (listed, not revoked, not expired), the app only needs a new profile (`profile`). Otherwise it's installed again: `reinstall` with `reason: "certificate"` (revoked or replaced) or `"unmarked"` (no mark: installed before marks, or by another tool). SideStore (alone or inside LiveContainer, from the catalog) is `reinstall` with `reason: "sidestore"`, installed over itself with its data kept, whenever the version on the device can be had: this computer's kept copy of that version, or that version's release (stable releases are found by their version tag, `catalog.resolve(appId, channel, signal, version)`). SideStore shows the expiry of the profile inside its own files (read each time it opens), which a new profile on the device doesn't change, and nothing outside SideStore can update the date it keeps itself. When the version can't be had (an older Nightly, whose single tag has moved on), it gets a new profile only.
- **A refresh never changes an app's version.** An app installed again goes from the kept copy only when it is the version on the device (the app may have updated itself since); otherwise the source carries `version` (catalog, link or an AltStore source's entry for that version), and the inspect step refuses any other version with `installer.version_unavailable`. A newer version is **Update**'s job.
- **`refreshApps({ udid, accountId, teamId?, profiles, apps })`** is Refresh, in one run. The apps in `apps` are signed and installed again, as in installApps (steps numbered from 0). Each bundle id in `profiles` gets a `profiles-N` step (numbered after them): a new profile from Apple for the app and its extensions, installed on the device, and the old ones removed. This is how SideStore refreshes: nothing is installed again, and it works for an app whose IPA this computer never had. With only profiles, the run skips the certificate and App ID steps.
- A Refresh or Update from a link names the app it replaces (`replaces`, its original bundle id). The inspect step refuses any other app (`installer.wrong_app`) before any Apple call, so a link in an app's mark, or in a source, can't put another app in its place with its data.
- An app installed again from its kept IPA is `{ kind: "installed", bundleId }`: the rpc server asks the Engine for the app's kept IPA and record (`installedSource`); the flow checks it again and keeps its certificate trust (no question), and SideStore gets its pairing file as on its first install. The same bundle id and team make it an upgrade: the app keeps its data. An app without a kept IPA fails with `installer.kept_ipa_missing`.
- `removeApp({ udid, bundleId })` uninstalls the app and forgets it.

### Repair SideStore

- **`checkSideStore({ udid, accountId, teamId? })`** reads, without changing anything:
  - the device: locked (then nothing else is read: an app's container stays closed) and Developer Mode;
  - SideStore among the user apps (`com.SideStore.SideStore` or `com.SideStore.SideStore.<TEAMID>`): its version, and `signedBy`: the team in use, another of the Apple ID's teams, or another Apple ID;
  - its expiry, from its profile, and the latest catalog version on its channel (none when the catalog can't be reached);
  - `signing`: the certificate in its IPAForge mark against the signing team's valid certificates (listed, not revoked, not expired), or `unknown` without a mark;
  - `ownCertificate`: `ALTCertificateID` in its Info.plist (the serial of the certificate it refreshes with) against the same list: `valid`, `missing`, or `other` (it may have replaced it with one of its own);
  - `pairing`: the `HostID` in its pairing file against this computer's pair record: `this-computer`, `other-computer` or `missing`.
  - `remotePairing` (iOS 17.4 and later): its `PairingFile_RemoteRP.plist` against the remote pairing this computer saved, checked with the device (pair-verify): `accepted`, `rejected`, `other-computer` or `missing`; `not-needed` below iOS 17.4.
- **`repairSideStore({ udid, accountId, teamId?, channel?, bundleId, reinstall, profile, pairing })`** runs the fixes in one run. With `reinstall`, the SideStore install's steps (pipeline `repairSideStore`), which bring a certificate, a profile and the pairing file. Otherwise, a new profile (`profiles-0`, as Refresh does) and/or this computer's pairing file (`pairing`), replacing what's there.

### Place pairing file

Opens the device and the account, finds the pairing apps on the device (SideStore, LiveContainer, StikDebug, StikStore), asks which ones should get this computer's pairing file, and writes it. Sideloaded copies count only when one of the account's teams signed them. With `keep-existing`, files that are already there are left alone.

## The run in the log

Every run also writes its story to the log, under `installer.run` with the flow's id: started, each step done (with what it did) or failed with its code, automatic retries, the questions it waited on, and how it ended. Progress ticks are left out. **Show logs** in the recovery box opens Logs on exactly that run.

## Step details

Each step tells the UI what it did, with `context.detail(detail)` (a `step-detail` event). The UI shows it under the step once the step is done:

| Step | Detail |
|---|---|
| `device` | the model, the iOS version, and the connection (USB or Wi-Fi) |
| `resolve-N` | the release version and channel |
| `download-N` | the size, and whether it came from the download cache |
| `inspect-N` | the app's name, version and number of extensions |
| `sign-in` | the saved session reused, renewed with the saved password, or signed in with a typed password |
| `team` | the team, and whether it is free |
| `register-device` | registered now, or already registered |
| `certificate` | reused, created, or replaced after a revoke |
| `app-ids` | how many are created and reused, and how many are left this week |
| `free-apps-N` | the free apps on the device and the limit, and the app removed to make room |
| `provision-N` | the number of profiles |
| `sign-N` | the number of bundles signed, and whether the IPA was compressed (over Wi-Fi) |
| `install-N` | uploading, then installing |

While they run, steps also report how far they are (`step-progress` with a detail):

| Step | Progress detail |
|---|---|
| `download-N` | `received`, `total` and `elapsedMs` |
| `provision-N` | `phase: "provisioning"`, the `task` (`team`, `app-ids`, `app-group`, `profiles`), its requests `done` of `total`, and `elapsedMs`; reported after each request to Apple |
| `install-N`, uploading | `phase: "uploading"`, its own `percent`, `received` (bytes sent), `total` and `elapsedMs` |
| `install-N`, installing | `phase: "installing"`, installd's own `percent` and `status` (`VerifyingApplication`, `InstallingApplication`…) and `elapsedMs` |

The UI turns them into a bar with the bytes, the speed and the time left, the provisioning task with its count ("Getting profiles · 2 of 5"), or iOS's percent and phase.

**USB or Wi-Fi.** A device on both is used over USB (usbmuxd lists it twice; the cable is several times faster). Over Wi-Fi the signed IPA is written compressed (`wifiCompressionLevel`, deflate 6), usually less than half the bytes to send; over USB it stays stored (uncompressed), which is quicker to write.
| `pairing` / `place` | the apps that got the pairing file |
| `certificate-sharing-N` | whether the certificate was shared |

## Free-app limit

A free team can have 3 apps on one device, and iOS counts expired ones too. Before installing, IPAForge works out which installed apps hold a slot:

- it reads the provisioning profiles on the device;
- a profile is a free one when it belongs to the account's free team, or when it lives at most a week (free profiles last 7 days, paid ones a year);
- the apps those profiles name are looked up on the device; only installed apps count;
- the app being reinstalled or upgraded does not count, because it keeps its own slot.

When there is no room, IPAForge asks which app to remove, then uninstalls it and removes its profiles (and its extensions' profiles). If iOS still refuses the install for the free-app limit, IPAForge offers the apps named in the refusal and tries once more. The limit is `freeAppLimit` in `packages/installer/src/domain/config.ts`.

## Prompts

A flow pauses on a prompt until it gets an answer. The UI answers by `kind`:

| Kind | Asked when | Answer |
|---|---|---|
| `apple.password` | The saved session expired and no password is stored | The password |
| `apple.two_factor_method` | Apple offers several ways to get a code | A method |
| `apple.two_factor_code` | Apple asks for a second factor (asked again after a wrong code) | The code |
| `apple.choose_team` | Several teams, none requested or remembered | A team ID |
| `apple.revoke_certificate` | The team has no room for another certificate | A serial number |
| `device.choose_app_to_remove` | Installing would go over the free-app limit | A bundle ID |
| `installer.share_certificate` | An imported IPA contains SideStore | Yes or no |
| `device.choose_pairing_apps` | Placing the pairing file | Bundle IDs |

Declining a prompt ends the run with `installer.prompt_cancelled`.

## Failures and recovery

`engine.classify(error)` turns any failure into an `ErrorCode` and a list of recovery actions, such as `switch-account`, `revoke-certificate`, `enable-developer-mode`, `unlock-device`, `choose-app-to-remove`, `change-anisette-server` or `retry`. The catalogue is data (`packages/installer/src/diagnostics/catalogue.ts`), built from [the failure catalogue](design/failure-catalogue.md), and covers every code. Errors from outside IPAForge still get a code (`internal.unexpected`). When Apple bans the account's profiles on a device (`device.profile_banned`), the account is marked as banned there and the only recovery offered is another Apple ID.

**No App IDs left, but Apple's count was negative.** Apple sometimes reports a negative number of App IDs left. IPAForge counts that as none (the quota is `isUnreliable`), and `apple.app_id_quota` says `unreliable: true`. Its recovery then offers **Try anyway** first: the run starts again with `tryAnyway`, and both checks (the run's budget and the provisioning) let the App IDs through to Apple, which creates them or refuses with the real limit.

A failed or cancelled run returns a checkpoint. Passing it back as `resume` skips the finished steps. The device and the Apple session are opened again as needed.

## Watching devices

`engine.watchDevices(listener, { signal })` streams connected devices from usbmuxd's `Listen` instead of polling. It reads the list once, then sends each attach and detach with the list after it. One usbmuxd connection serves every listener, and a late listener gets the current list at once. If the connection drops (the usbmuxd service restarted, the computer slept), it reconnects with backoff (1 s doubling to 30 s) and sends one full list after reconnecting. Only when usbmuxd refuses `Listen` outright does it fall back to reading the list every 30 s. It stops when the last listener unsubscribes or its signal aborts. The timings are `deviceReconnectBaseMs`, `deviceReconnectMaxMs` and `devicePollIntervalMs` in `packages/installer/src/domain/config.ts`.

## For contributors

`install-probe` runs the real flows against a real iPhone and Apple account. Sign in first with `apple-probe signin`, and pair the device with `device-probe pair`.

```bash
pnpm --filter @ipaforge/desktop install-probe plan <file.ipa|sidestore>   # READ-ONLY preview
pnpm --filter @ipaforge/desktop install-probe sidestore --yes            # --livecontainer, --channel stable|nightly
pnpm --filter @ipaforge/desktop install-probe ipa <file.ipa…> --yes
pnpm --filter @ipaforge/desktop install-probe pairing --yes              # --keep-existing
```

- `plan` writes nothing to Apple or the device. It prints the IPA inspection, whether the device can run the app (`InstallPlan.compatibility`: the code and data the install would stop with, reported without failing the plan), the version already on the device (`installedVersion`, when it is there), the new identity, the App ID budget against what is needed, the free-app slots and the certificate status.
- The other commands refuse to run without `--yes`. Every command takes `--account <id>` and `--udid <udid>`; `plan`, `sidestore` and `ipa` also take `--team <id>`.
- Prompts are answered in the terminal; an empty answer declines. On failure the probe prints the `classify()` result.
- It shares `apple-probe`'s saved data under `~/.ipaforge/dev`. Each team's certificate and key are kept in the encrypted store, IPAs in `downloads/` and signed IPAs in `scratch/` until they are installed.

## See Also

- [Code Signing](signing.md)
- [Device](device.md)
- [Apple Account](apple-account.md)

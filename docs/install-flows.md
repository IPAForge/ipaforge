[← Apple Account](apple-account.md) · [Back to README](../README.md) · [Engine RPC →](rpc.md)

# Install Flows

`@loadstar/installer` puts the other packages together. Each flow is a pipeline: an ordered list of steps over one shared state, with progress, cancellation, retries for read-only steps and resume from a checkpoint. The UI (and the `install-probe` maintainer tool) talk to it only through the Engine facade, `createEngine()` in `packages/installer/src/engine.ts`.

## The flows

### Install SideStore

Installs SideStore, or LiveContainer with SideStore inside, from the catalog. The steps:

| # | Step | What it does |
|---|---|---|
| 1 | `device` | Opens the device and stops at once if it is locked, Developer Mode is off, or it does not trust this computer |
| 2 | `resolve-0` | Picks the release: the channel you asked for, or the one recommended for your iOS version |
| 3 | `download-0` | Downloads it into the cache and checks its SHA-256 |
| 4 | `inspect-0` | Reads the IPA (structure, extensions, encryption) before anything is sent to Apple |
| 5 | `sign-in` | Opens the saved Apple account; asks for the password or a 2FA code only when Apple wants them |
| 6 | `team` | Uses the requested team, the one remembered for the account, or the only one; otherwise asks |
| 7 | `register-device` | Registers the device with the team if it is not registered yet |
| 8 | `certificate` | Reuses the stored certificate; otherwise creates one. When the team has no room, asks which certificate to revoke |
| 9 | `app-ids` | Plans the new bundle IDs and checks the App ID budget. If it does not fit, the flow stops with the date the next slot frees up |
| 10 | `free-apps-0` | Free teams only: makes room under the free-app limit (see below) |
| 11 | `provision-0` | Creates the App IDs and app group, and downloads the profiles |
| 12 | `sign-0` | Signs the app and puts the signing certificate into SideStore (`ALTCertificate.p12`) |
| 13 | `install-0` | Installs it with progress |
| 14 | `pairing` | Places this computer's pairing file into the installed app (for LiveContainer, into the SideStore inside it) |
| 15 | `remember` | Remembers the team for the account |

A new certificate is stored with its private key, per account and team, as soon as Apple issues it. The key never appears in the flow's state or checkpoint.

### Install apps

Installs one or more IPAs, from the catalog or from files, one after another. All apps are downloaded and inspected first. The account steps then run once (sign-in, team, device, certificate) and check the App ID budget for all apps together. After that, each app goes through `free-apps`, `provision`, `sign` and `install`.

The signing certificate goes only into an app Loadstar has a reason to trust:

- a catalog release whose download matched its published SHA-256;
- a file you picked, only after you agree. If the IPA really contains SideStore (checked from its bundles, never from the bundle ID alone), Loadstar asks before sharing the certificate and its private key. If you decline, the app is installed without it.

### Place pairing file

Opens the device and the account, finds the pairing apps on the device (SideStore, LiveContainer, StikDebug, StikStore), asks which ones should get this computer's pairing file, and writes it. Sideloaded copies count only when one of the account's teams signed them. With `keep-existing`, files that are already there are left alone.

## Free-app limit

A free team can have 3 apps on one device, and iOS counts expired ones too. Before installing, Loadstar works out which installed apps hold a slot:

- it reads the provisioning profiles on the device;
- a profile is a free one when it belongs to the account's free team, or when it lives at most a week (free profiles last 7 days, paid ones a year);
- the apps those profiles name are looked up on the device; only installed apps count;
- the app being reinstalled or upgraded does not count, because it keeps its own slot.

When there is no room, Loadstar asks which app to remove, then uninstalls it and removes its profiles (and its extensions' profiles). If iOS still refuses the install for the free-app limit, Loadstar offers the apps named in the refusal and tries once more. The limit is `freeAppLimit` in `packages/installer/src/domain/config.ts`.

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

`engine.classify(error)` turns any failure into an `ErrorCode` and a list of recovery actions, such as `switch-account`, `revoke-certificate`, `enable-developer-mode`, `unlock-device`, `choose-app-to-remove`, `change-anisette-server` or `retry`. The catalogue is data (`packages/installer/src/diagnostics/catalogue.ts`), built from [the failure catalogue](design/failure-catalogue.md), and covers every code. Errors from outside Loadstar still get a code (`internal.unexpected`). When Apple bans the account's profiles on a device (`device.profile_banned`), the account is marked as banned there and the only recovery offered is another Apple ID.

A failed or cancelled run returns a checkpoint. Passing it back as `resume` skips the finished steps. The device and the Apple session are opened again as needed.

## For contributors

`install-probe` runs the real flows against a real iPhone and Apple account. Sign in first with `apple-probe signin`, and pair the device with `device-probe pair`.

```bash
pnpm --filter @loadstar/desktop install-probe plan <file.ipa|sidestore>   # READ-ONLY preview
pnpm --filter @loadstar/desktop install-probe sidestore --yes            # --livecontainer, --channel stable|nightly
pnpm --filter @loadstar/desktop install-probe ipa <file.ipa…> --yes
pnpm --filter @loadstar/desktop install-probe pairing --yes              # --keep-existing
```

- `plan` writes nothing to Apple or the device. It prints the IPA inspection, the new identity, the App ID budget against what is needed, the free-app slots and the certificate status.
- The other commands refuse to run without `--yes`. Every command takes `--account <id>` and `--udid <udid>`; `plan`, `sidestore` and `ipa` also take `--team <id>`.
- Prompts are answered in the terminal; an empty answer declines. On failure the probe prints the `classify()` result.
- It shares `apple-probe`'s saved data under `~/.loadstar/dev`. Each team's certificate and key are kept in the encrypted store, IPAs in `downloads/` and signed IPAs in `scratch/` until they are installed.

## See Also

- [Code Signing](signing.md)
- [Device](device.md)
- [Apple Account](apple-account.md)

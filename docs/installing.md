[← Back to README](../README.md) · [Getting Started →](getting-started.md)

# Installing IPAForge

> **IPAForge is in alpha.** The first test builds are on the **[Releases page](https://github.com/SirReaDy/ipaforge/releases)** as pre-releases. They work, but expect rough edges, and please [report](#problems) what breaks.

## Download

Get IPAForge from the **[Releases page](https://github.com/SirReaDy/ipaforge/releases)**, and only from there. Each release lists its files' SHA-256 checksums in `SHA256SUMS.txt`.

| Your computer | File |
|---|---|
| **Mac with Apple silicon** (M1 and later) | `IPAForge-<version>-mac-arm64.dmg` |
| **Mac with Intel** | `IPAForge-<version>-mac-x64.dmg` |
| **Windows 10/11** (x64; also runs on Windows on Arm) | `IPAForge-<version>-win-x64.exe`, or `.msi` for managed installs |
| **Linux** (x64, arm64) | `IPAForge-<version>-linux-*.AppImage` runs anywhere; `.deb` and `.rpm` integrate with your package manager |

The `.zip`, `.blockmap` and `latest*.yml` files are for automatic updates; you don't need them.

### Checking a download

Every file has a signature next to it, `<file>.sigstore.json`, made by the release workflow with its GitHub identity: it proves the file was built by this repository's workflow from the release tag, and hasn't changed since. With [cosign](https://docs.sigstore.dev/cosign/system_config/installation/):

```sh
cosign verify-blob IPAForge-<version>-mac-arm64.dmg \
  --bundle IPAForge-<version>-mac-arm64.dmg.sigstore.json \
  --certificate-identity "https://github.com/SirReaDy/ipaforge/.github/workflows/release.yml@refs/tags/v<version>" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

This is not code signing: your system still warns about an unsigned app (below).

### Alpha builds aren't signed yet

Code signing (a Windows certificate, Apple notarisation) comes before the first beta. Until then, your system warns the first time you open IPAForge:

- **macOS** says Apple can't check it for malicious software. Click **Done**, then open **System Settings › Privacy & Security**, scroll to *"IPAForge" was blocked* and click **Open Anyway**. From Terminal, `xattr -dr com.apple.quarantine /Applications/IPAForge.app` does the same.
- **Windows** SmartScreen says it protected your PC: click **More info › Run anyway**.
- **The macOS keychain:** saved Apple IDs are encrypted with a key kept in one keychain item of IPAForge's own, *IPAForge Safe Storage* (Chrome, VS Code and Slack keep theirs the same way). After an update, macOS may ask for your login password before IPAForge reads it: click **Always Allow**. With **Deny**, IPAForge works but keeps Apple IDs only until it quits, and **Accounts** says so.
- **Linux** doesn't check signatures; make the AppImage executable (below).

The app doesn't update itself yet: download the next build from the Releases page.

## Before you start

1. **An Apple ID.** A free account works. Use an account whose 2FA can show a code on an Apple device (iPhone, iPad or Mac). Apple currently refuses SMS-only verification for third-party apps.
2. **Your iPhone or iPad, on iOS 15 or later, with a passcode set**, and a USB cable that carries data.
3. **What your computer needs to talk to the device:**

| System | What you need |
|---|---|
| **Windows** | **Apple Devices** from the Microsoft Store (or iTunes from apple.com), which installs the Apple Mobile Device Service |
| **macOS** | Nothing extra |
| **Linux** | `usbmuxd`, e.g. `sudo apt install usbmuxd` / `sudo dnf install usbmuxd`; it starts when a device is plugged in |

## Install

### Windows
1. Run `IPAForge-<version>-win-x64.exe` and follow the installer (the first time, **More info › Run anyway**).
2. Start IPAForge from the Start menu.

### macOS
1. Open `IPAForge-<version>-mac-<arch>.dmg` and drag **IPAForge** into **Applications**.
2. Start it from Applications (the first time, allow it as described above).

### Linux
- **AppImage:** `chmod +x IPAForge-<version>-linux-*.AppImage`, then run it.
- **Debian/Ubuntu:** `sudo apt install ./IPAForge-<version>-linux-amd64.deb`
- **Fedora/openSUSE:** `sudo dnf install ./IPAForge-<version>-linux-x86_64.rpm`

## First run

Start on **Install**: it says what to fix first, one thing at a time (a guided first-run setup comes in a later release):

1. **Connect your device** and tap **Trust** on it. Unlock it first.
2. **Developer Mode** (iOS 16 and later): IPAForge makes the switch appear in **Settings › Privacy & Security**. Turn it on, and the device restarts.
3. **Sign in with your Apple ID** and enter the code shown on your trusted device.
4. **Choose your team**, if your Apple ID has more than one.
5. **Choose what to install:** SideStore, LiveContainer + SideStore, or your own `.ipa` files.

After installing SideStore:
- **Trust the developer profile:** **Settings › General › VPN & Device Management**.
- **Install LocalDevVPN** from the App Store; SideStore uses it to refresh apps.
- Open SideStore and sign in.

IPAForge places the pairing file and certificate SideStore needs automatically.

## Updating and uninstalling

- **Updates:** during the alpha, download the next build from the Releases page (automatic updates come later).
- **Uninstall:**
  - **Windows:** Settings › Apps;
  - **macOS:** drag IPAForge to the Bin;
  - **Linux:** remove the AppImage or the package.
- **Your saved accounts** are kept in the system keychain. Sign them out in **Manage → Accounts** before uninstalling if you want them gone.

## Problems?

- [Device](device.md) explains device errors, and [Apple Account](apple-account.md) explains sign-in errors. Each error message names its code.
- Still stuck? [Open an issue](https://github.com/SirReaDy/ipaforge/issues/new/choose) with the error code. **Never post** your Apple ID password, verification codes, pairing files, certificates or device UDID.

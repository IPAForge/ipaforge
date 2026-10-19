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

The macOS app itself is signed with IPAForge's own certificate. To check the app you installed:

```sh
codesign -d -r- /Applications/IPAForge.app
```

It must print exactly:

```
designated => identifier "io.github.sirready.ipaforge" and certificate root = H"72fc71d719dcb0c2bf3caf939a41d6c3afb1da63"
```

(The certificate's SHA-256 fingerprint is `34:91:A0:2E:C9:E5:2B:B7:A1:70:73:12:BA:B2:91:D8:9B:75:D8:A9:5B:B3:01:F4:50:3A:CB:4D:9D:67:DE:BD`.)

Neither check replaces Apple's notarisation, so your system still asks before the first open (below).

### Opening IPAForge the first time

IPAForge isn't notarised by Apple or signed with a Windows certificate yet, so your system asks once before it opens a new download.

**macOS**

1. Open the DMG and drag **IPAForge** into **Applications**.
2. Open IPAForge. macOS says *"IPAForge" Not Opened* because Apple can't check it. Click **Done** (not *Move to Bin*).
3. Open **System Settings › Privacy & Security** and scroll down to **Security**. Next to *"IPAForge" was blocked to protect your Mac*, click **Open Anyway**, then confirm with your password or Touch ID.
4. IPAForge opens, and from then on it opens normally. Each new version you download asks once again.

From Terminal, `xattr -dr com.apple.quarantine /Applications/IPAForge.app` skips steps 2 and 3.

**The keychain.** The first time you sign in, macOS asks whether IPAForge may use *IPAForge Safe Storage*, the keychain item of its own that protects your saved Apple IDs (Chrome, VS Code and Slack keep theirs the same way). Click **Always Allow**. Every IPAForge release is signed with the same IPAForge certificate, so updates don't ask again. With **Deny**, IPAForge still works but keeps Apple IDs only until it quits, and **Accounts** says so.

**Windows.** SmartScreen says it protected your PC: click **More info › Run anyway**.

**Linux** doesn't check signatures; make the AppImage executable (below).

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

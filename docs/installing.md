[← Back to README](../README.md) · [Getting Started →](getting-started.md)

# Installing IPAForge

> **IPAForge is pre-alpha: there is no installable release yet.** This page describes how installing will work for 1.0. Until then, developers can run the engine from source ([Getting Started](getting-started.md)).

## Download

Get the latest version from the **[Releases page](https://github.com/SirReaDy/ipaforge/releases/latest)**. Only download IPAForge from there. Builds are signed, and the app updates itself.

| Your computer | File | Notes |
|---|---|---|
| **Windows 10/11** (x64, arm64) | `IPAForge-Setup-<version>.exe` | Code-signed installer |
| **macOS** (Apple silicon, Intel) | `IPAForge-<version>.dmg` | Signed and notarised by Apple |
| **Linux** (x64, arm64) | `IPAForge-<version>.AppImage`, `.deb`, `.rpm` | AppImage runs anywhere; deb/rpm integrate with your package manager |

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
1. Run `IPAForge-Setup-<version>.exe` and follow the installer.
2. Start IPAForge from the Start menu.

### macOS
1. Open `IPAForge-<version>.dmg` and drag **IPAForge** into **Applications**.
2. Start it from Applications. The build is notarised, so macOS opens it without warnings.

### Linux
- **AppImage:** `chmod +x IPAForge-<version>.AppImage`, then run it.
- **Debian/Ubuntu:** `sudo apt install ./IPAForge-<version>.deb`
- **Fedora/openSUSE:** `sudo dnf install ./IPAForge-<version>.rpm`

## First run

IPAForge walks you through setup. Each step checks itself and explains what to do if something is missing:

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

- **Updates:** IPAForge checks for updates and installs them after asking.
- **Uninstall:**
  - **Windows:** Settings › Apps;
  - **macOS:** drag IPAForge to the Bin;
  - **Linux:** remove the AppImage or the package.
- **Your saved accounts** are kept in the system keychain. Sign them out in **Manage → Accounts** before uninstalling if you want them gone.

## Problems?

- [Device](device.md) explains device errors, and [Apple Account](apple-account.md) explains sign-in errors. Each error message names its code.
- Still stuck? [Open an issue](https://github.com/SirReaDy/ipaforge/issues/new/choose) with the error code. **Never post** your Apple ID password, verification codes, pairing files, certificates or device UDID.

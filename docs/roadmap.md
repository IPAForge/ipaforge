[← User Interface](ui.md) · [Back to README](../README.md) · [Contributing →](contributing.md)

# Roadmap

The detailed roadmap, with each phase's scope, is [design/roadmap.md](design/roadmap.md).

| # | Phase | Delivers |
|---|---|---|
| 0 | Foundation ✓ | Monorepo, `kernel`, boundary checker, multi-OS CI |
| 1 | Signer ✓ | Production pure-TS signer with Apple-parity fixtures, verified against a real Apple Development certificate |
| 2 | Device layer ✓ | usbmux, lockdown, pairing, AFC, house_arrest, install, profiles |
| 3 | Apple account ✓ | Anisette with fallback, login, 2FA, saved credentials |
| 4 | Developer services ✓ | Teams, certificates, app IDs, groups, profiles |
| 5 | Installer engine + catalog ✓ | Pipelines, flows, release catalog, error catalog |
| 6 | UI foundation ✓ | HeroUI + Tailwind shell, colour palettes, i18n, Engine connection, accounts, devices, install run, its questions, recovery, step details, the log viewer, and screenshot and accessibility tests (#28–#58) |
| 7 | Onboarding ✓ | First-run guided wizard: 7a the setup guide (computer, iPhone and Apple ID checks) and the tour ✓ (#95); 7b installing SideStore from the guide and the steps on the iPhone ✓ (#96) |
| 8 | Install & preload UX ✓ | One-click SideStore ✓, live run view ✓, recovery screens ✓, Apple ID switch ✓, preload picker ✓ (#59), app sources ✓ (#66), detailed install progress ✓ (#67), the Apps section ✓ (#68), Repair SideStore ✓ (#70), SideStore QR codes ✓ (#71), on-device checklist ✓ (#72), the smaller notes ✓ (#73), anisette servers in Settings ✓ (#80), days left as SideStore counts them and SideStore refreshed with its own date ✓ (#81), installs that never hang on a locked device and Cancel refresh ✓ (#93) |
| 9 | Desktop app ✓ (#61, #62, #63, #64, #65, #69, #74, #75, #77) | Electron packages for Windows, macOS, Linux ✓; the macOS app signed with IPAForge's own certificate ✓; auto-update and What's new ✓ (#74); Windows signing and notarisation moved to 1.0 |
| 10 | Management tools ✓ | Developer Portal page (#86), pairing files per app (#87), saving signed IPAs (#90), `.p12` import and export (#93) |
| 11 | Wireless & remote pairing | 11.1 the iOS 17.4+ remote pairing file for SideStore ✓ (#82); 11.2a Wi-Fi without usbmuxd, devices found on the network ✓ (#97); 11.2b the iOS 17.4+ device tunnel over USB ✓ (#98); 11.2c the tunnel over Wi-Fi, with IPAForge's own TLS-PSK ✓ (#99); 11.2d installs through the Wi-Fi tunnel ✓ (#100); 11.3 Apple TV and Vision Pro (installing over Wi-Fi to a paired device works already) |
| 12 | Release 1.0 | Docs site, translations, security review, Windows code signing and Apple notarisation, reusable packages on npm |

## See Also

- [Contributing](contributing.md): how a phase goes from plan to code
- [Architecture](architecture.md): what each phase builds on

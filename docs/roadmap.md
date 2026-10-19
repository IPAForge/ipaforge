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
| 7 | Onboarding | First-run guided wizard |
| 8 | Install & preload UX (in progress) | One-click SideStore ✓, live run view ✓, recovery screens ✓, Apple ID switch ✓, preload picker ✓ (#59), app sources ✓ (#66), detailed install progress ✓ (#67), the Apps section ✓ (#68), Repair SideStore ✓ (#70), SideStore QR codes ✓ (#71); next: on-device checklist |
| 9 | Desktop app (alpha builds ✓, #61, #62, #63, #64, #65, #69) | Electron packages for Windows, macOS, Linux ✓; the macOS app signed with IPAForge's own certificate ✓; next: notarisation, Windows signing, auto-update |
| 10 | Management tools | Certificates, app IDs, pairing files, import/export |
| 11 | Wireless & remote pairing | Wi-Fi installs and the iOS 17+ RP pairing file |
| 12 | Release 1.0 | Docs site, translations, security review, release pipeline, reusable packages on npm |

## See Also

- [Contributing](contributing.md): how a phase goes from plan to code
- [Architecture](architecture.md): what each phase builds on

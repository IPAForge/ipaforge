[← Device](device.md) · [Back to README](../README.md) · [Contributing →](contributing.md)

# Roadmap

The detailed roadmap, with each phase's scope, is [design/roadmap.md](design/roadmap.md).

| # | Phase | Delivers |
|---|---|---|
| 0 | Foundation ✓ | Monorepo, `kernel`, boundary checker, multi-OS CI |
| 1 | Signer ✓ | Production pure-TS signer with Apple-parity fixtures, verified against a real Apple Development certificate |
| 2 | Device layer | usbmux, lockdown, pairing, AFC, house_arrest, install |
| 3 | Apple account | Anisette with fallback, login, 2FA, saved credentials |
| 4 | Developer services | Teams, certificates, app IDs, groups, profiles |
| 5 | Installer engine + catalog | Pipelines, flows, release catalog, error catalog |
| 6 | UI foundation | HeroUI + Tailwind shell, colour palettes, i18n |
| 7 | Onboarding | First-run guided wizard |
| 8 | Install & preload UX | One-click SideStore, preload picker, recovery screens |
| 9 | Desktop app | Electron packages for Windows, macOS, Linux; auto-update |
| 10 | Management tools | Certificates, app IDs, pairing files, import/export |
| 11 | Wireless & remote pairing | Wi-Fi installs and the iOS 17+ RP pairing file |
| 12 | Release 1.0 | Docs site, translations, security review, release pipeline |

Phases 2 and 3 can run in parallel. Loadstar is desktop-only (Windows, macOS, Linux); the web version was dropped on 2026-10-15.

## See Also

- [Contributing](contributing.md): how a phase goes from plan to code
- [Architecture](architecture.md): what each phase builds on

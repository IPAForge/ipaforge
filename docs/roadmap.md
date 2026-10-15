[← Code Signing](signing.md) · [Back to README](../README.md) · [Contributing →](contributing.md)

# Roadmap

The detailed roadmap, with each phase's scope, is [design/roadmap.md](design/roadmap.md).

| # | Phase | Delivers |
|---|---|---|
| 0 | Foundation ✓ | Monorepo, `kernel`, boundary checker, multi-OS CI |
| 1 | Signer ✓ | Production pure-TS signer with Apple-parity fixtures, verified against a real Apple Development certificate |
| 2 | Web device spike | Go/no-go on WebUSB device access and in-browser TLS |
| 3 | Device layer | usbmux, lockdown, pairing, AFC, house_arrest, install |
| 4 | Apple account | Anisette with fallback, login, 2FA, saved credentials |
| 5 | Developer services | Teams, certificates, app IDs, groups, profiles |
| 6 | Installer engine + catalog | Pipelines, flows, release catalog, error catalog |
| 7 | UI foundation | HeroUI + Tailwind shell, colour palettes, i18n |
| 8 | Onboarding | First-run guided wizard |
| 9 | Install & preload UX | One-click SideStore, preload picker, recovery screens |
| 10 | Desktop app | Electron packages for Windows, macOS, Linux; auto-update |
| 11 | Web app + relay | Browser build and the Apple/anisette relay |
| 12 | Management tools | Certificates, app IDs, pairing files, import/export |
| 13 | Wireless & remote pairing | Wi-Fi installs and the iOS 17+ RP pairing file |
| 14 | Release 1.0 | Docs site, translations, security review, release pipeline |

Phases 3 and 4 can run in parallel after Phase 1. Phase 2 decides how the web app reaches devices.

## See Also

- [Contributing](contributing.md): how a phase goes from plan to code
- [Architecture](architecture.md): what each phase builds on

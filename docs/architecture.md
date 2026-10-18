[← Getting Started](getting-started.md) · [Back to README](../README.md) · [Code Signing →](signing.md)

# Architecture

IPAForge uses **Explicit Architecture (ports & adapters)** with one package per bounded context. The authoritative version is `docs/design/architecture.md`; this page is the summary.

## Why ports & adapters

IPAForge is a desktop app (Electron) for Windows, macOS and Linux. The engine logic is the same everywhere; only the I/O is platform-specific:

| Concern | Desktop (Electron main / utility process) |
|---|---|
| Reach the device | usbmuxd socket (Unix socket on macOS/Linux, TCP 27015 on Windows) |
| TLS to device services | `node:tls` |
| Talk to Apple | direct HTTPS |
| Secrets | OS keychain (`safeStorage`) |
| Read IPAs | filesystem / download stream |

Core packages define **ports**, which are interfaces. `apps/desktop` provides the **adapters**, which implement them. Core packages never import `node:*`, `electron` or DOM APIs, and a boundary checker enforces this in CI. That keeps the engine testable without a phone or an Apple account, and keeps every OS difference in one place.

## Packages

| Package | Responsibility |
|---|---|
| `kernel` | `IPAForgeError` + `ErrorCode`, ports (Logger, HttpClient, SecretStore, FileSource, Clock, Cache), byte utilities |
| `signer` | Mach-O code signing, CodeResources, entitlements, CMS, IPA streaming |
| `device` | usbmux, lockdown, pairing, AFC, house_arrest, installation_proxy |
| `apple` | Apple ID login (GSA SRP + 2FA), anisette, developer services |
| `catalog` | Release sources, GitHub resolution, downloads, cache |
| `installer` | Pipelines and flows (install SideStore, preload, pairing), diagnostics, the **Engine** facade |
| `rpc` | Typed Engine ⇄ UI calls over Electron IPC |
| `ui` | React app rendered by the desktop shell (HeroUI + Tailwind, palettes, i18n) |

App (composition root): `apps/desktop` (Electron).

## Dependency rules

```
kernel  ←  signer, device, apple, catalog  ←  installer  ←  rpc  ←  ui
                                     apps/* wire adapters and mount ui
```

- Contexts depend only on `kernel`. Only `installer` combines contexts.
- `ui` talks to the engine only through `rpc`'s `EngineClient` (see [Engine RPC](rpc.md)).
- Platform code lives only in `apps/*`.

## Flows are pipelines

Every long operation, such as installing SideStore, is an ordered list of typed **steps** with weights, labels, cancellation and resume (for 2FA or choosing a team). The UI renders the pipeline. It never invents its own progress.

## Errors are codes

Failures become `IPAForgeError` with a stable code, for example `device.developer_mode_off`, `apple.app_id_quota` or `catalog.source_gone`. The UI maps each code to a recovery screen.

## Styling

There are no CSS files. The UI uses HeroUI components and Tailwind utility classes. Colour palettes are TypeScript data applied as HeroUI theme variables at runtime.

## See Also

- [Code Signing](signing.md): the most intricate context
- [Contributing](contributing.md): conventions and the boundary checker

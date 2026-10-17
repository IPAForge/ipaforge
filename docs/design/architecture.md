# Architecture: Explicit Architecture (Ports & Adapters, package-per-context)

## Overview

Loadstar is a desktop app for Windows, macOS and Linux (Electron). The engine's *logic* is the same on every OS: signing Mach-O binaries, speaking lockdown to an iPhone, authenticating against Apple. Only the *I/O* differs, and only slightly:

| Concern | Desktop (Electron main / utility process) |
|---|---|
| Reach the device | usbmuxd socket: `/var/run/usbmuxd` on macOS and Linux, TCP 27015 (Apple Mobile Device Service) on Windows |
| TLS to lockdown services (after `StartSession`) | `node:tls` |
| Talk to Apple | direct HTTPS |
| Keep secrets | OS keychain via `safeStorage` |
| Read IPAs | filesystem / download stream |

Explicit Architecture still pays off here. Each **package is a bounded context**. The pure domain and application code defines **ports**. `apps/desktop` is the **composition root** that plugs in **adapters**. The core never imports `node:*`, `electron` or DOM APIs, so it can be tested without a phone or an Apple account, and every OS difference stays in one place.

> The web version (WebUSB + relay) was dropped on 2026-10-15. Loadstar is desktop-only.

## Decision Rationale

- **Project type:** cross-platform desktop sideloading tool (Windows, macOS, Linux) with a TypeScript engine
- **Tech stack:** TypeScript 7, React 19 + HeroUI v3 + Tailwind v4, Electron 44 (electron-vite)
- **Key factor:** one engine, three operating systems. Ports keep platform differences at the edge, and golden-fixture tests keep the engine provably correct.

## Folder Structure

```
loadstar/
├── packages/                       # ── BOUNDED CONTEXTS (pure, platform-agnostic) ──
│   ├── kernel/                     # shared kernel: Result, LoadstarError, events, Logger port, bytes utils
│   │   └── src/
│   │       ├── errors/             # LoadstarError, ErrorCode catalog (codes only, no UI text)
│   │       ├── ports/              # Logger, Clock, HttpClient, SecretStore, FileSource, Cache
│   │       └── bytes/              # Uint8Array helpers, base64, hex, DataView readers
│   │
│   ├── signer/                     # CONTEXT: code signing (spike-proven)
│   │   └── src/
│   │       ├── domain/             # MachO, Slice, CodeDirectory, SuperBlob, Entitlements, Requirement, CodeResources
│   │       ├── application/        # signBinary, signBundle, signIpa, reconcileEntitlements
│   │       └── infrastructure/     # cms (pkijs), hashing (WebCrypto batched + noble fallback), ipa-zip (zip.js)
│   │
│   ├── device/                     # CONTEXT: talking to iOS devices
│   │   └── src/
│   │       ├── domain/             # UsbmuxDevice, DeviceInfo, PairRecord (+PEM), profiles, install errors, pairing apps
│   │       │                       # (data), config, constants; ports: DeviceTransport → Connection (with startTls)
│   │       ├── infrastructure/     # framing, usbmux, lockdown, pairing certificates (pkijs), afc, house-arrest,
│   │       │                       # installation-proxy, misagent, amfi
│   │       └── application/        # DeviceManager facade: pair, sessions, installIpa, profiles, app files, checks
│   │
│   ├── apple/                      # CONTEXT: Apple account + developer services
│   │   └── src/
│   │       ├── domain/             # Account, Team, Certificate, AppId, Profile, Session; ports: AnisetteProvider
│   │       ├── auth/               # GSA SRP-6a login, 2FA (trusted device, SMS), token refresh
│   │       ├── anisette/           # v3 client, provider chain with health checks + fallback, native (macOS) hook
│   │       └── developer/          # developer services API (teams, certs, app IDs, groups, profiles, devices)
│   │
│   ├── catalog/                    # CONTEXT: where apps come from
│   │   └── src/
│   │       ├── domain/             # Source, Release, Channel, AppRef
│   │       └── application/        # resolveRelease (GitHub API), download (stream + checksum), cache
│   │
│   ├── installer/                  # CONTEXT: orchestration (application layer over all contexts)
│   │   └── src/
│   │       ├── pipeline/           # Step<I,O>, Pipeline runner, progress events, cancellation, resume
│   │       ├── flows/              # installSideStore, installApps (preload), placePairing, refreshCertificate
│   │       ├── diagnostics/        # error classification → ErrorCode (locked device, quota, DevMode…)
│   │       └── engine.ts           # Engine facade = the API every shell exposes to the UI
│   │
│   ├── rpc/                        # typed request/stream RPC (Engine ⇄ UI) over Electron IPC
│   │
│   └── ui/                         # React app rendered by the desktop shell (presentation layer)
│       ├── index.html, vite.config.ts  # the UI as a plain browser app (dev server, build)
│       └── src/
│           ├── main.tsx            # browser entry: browser services, then <App/>
│           ├── App.tsx             # providers (services, query, theme) + router; what every host mounts
│           ├── router.tsx          # routes; sections.ts lists the sidebar sections and groups
│           ├── styles.css          # the only stylesheet (Tailwind + HeroUI)
│           ├── components/         # the shell and thin compositions of HeroUI components (no CSS files)
│           ├── features/           # install/, preload/, devices/, accounts/, certificates/, logs/, settings/
│           ├── hooks/              # useTheme, useUiServices, later the EngineClient hooks
│           ├── services/           # what the host provides (UiServices) + browser and in-memory implementations
│           ├── theme/              # palettes/ (data → HeroUI CSS variables), store/, provider/
│           └── locales/            # UI strings (i18next locales/*.json from 6b)
│
├── apps/                           # ── COMPOSITION ROOTS (adapters + wiring) ──
│   └── desktop/                    # Electron
│       └── src/
│           ├── main/               # Engine wiring: Node adapters, secrets (file key sealed by safeStorage), rpc server per window
│           ├── preload/            # forwards the rpc MessagePort to the page; exposes no API
│           └── renderer/           # wraps the port in a Transport, createEngineClient, mounts @loadstar/ui
│
├── fixtures/                       # golden inputs + Apple codesign outputs (generated on macOS CI)
└── docs/                           # user and contributor docs; design/ holds architecture, roadmap, research
```

## Dependency Rules

```
kernel  ←  signer, device, apple, catalog  ←  installer  ←  rpc  ←  ui
                                                   ↑                  ↑
                                         apps/* (composition roots wire adapters + mount ui)
```

- ✅ Every context depends on `kernel` only. `installer` depends on the contexts it orchestrates.
- ✅ `apps/*` may depend on everything and are the **only** place adapters for `node:*`, `electron` and `fetch` live.
- ✅ `ui` depends on `rpc` types (an `EngineClient` interface) and **never** on `installer` internals or any context directly.
- ❌ `signer`, `device`, `apple` and `catalog` never import each other. Cross-context work happens only in `installer`.
- ❌ No package under `packages/` imports `node:*`, `electron` or DOM globals other than `crypto.subtle`, `TextEncoder` and `fetch` types. Biome rules plus a `check:boundaries` script enforce this.
- ❌ `ui` never calls an adapter (no direct `fetch` to Apple, no device sockets).
- 🔧 Enforcement: Biome `noRestrictedImports` for `packages/**` (built-ins, `electron`) plus `scripts/check-boundaries.ts`, which uses the edge table in `scripts/boundaries.config.ts`.
- 🔧 Type-level guard: packages compile against `lib: ["ES2023", "WebWorker"]` with `types: []`, so Node or DOM-only globals don't type-check in core code.

## Layer/Module Communication

- **Ports in, adapters out.** A context declares interfaces (`DeviceTransport.connect(udid, port): Promise<Duplex>`, `HttpClient.request(req): Promise<Response>`), and the shell injects implementations into the `Engine` constructor.
- **Engine facade.** `installer/engine.ts` is the only API the UI sees: commands (`installSideStore`, `preload`, `signIn`, …), queries (`listDevices`, `listCertificates`, …) and progress streams.
- **Typed RPC.** `rpc` serializes Engine calls over an Electron `MessageChannelMain` between the main (or utility) process and the renderer. Payloads are validated with zod on both sides. Long operations stream `ProgressEvent`s and accept an `AbortSignal`.
- **Pipelines.** A flow is an ordered list of `Step`s. Each step is a pure-ish async function `(ctx, input) => output` with a stable id, i18n label key, weight (for the progress bar) and an optional `undo`. The runner handles progress, cancellation, retries (only for steps marked idempotent) and resume after an interactive prompt (2FA, choose team, revoke certificate).
- **Errors.** Everything throws or returns `LoadstarError { code, cause?, data? }`. `installer/diagnostics` classifies raw failures, such as a lockdown `PasswordProtected`, Apple result code `-80045` or installation_proxy `DeviceNotSupportedByThinning`, into a catalogued `ErrorCode`. The UI maps `ErrorCode` to a recovery screen.

## Key Principles

1. **Platform-free core.** If code needs `node:*`, a DOM API or Electron, it belongs in an adapter in `apps/*` behind a port.
2. **Correctness by golden fixtures.** The signer, plist and entitlement encoders are tested against Apple `codesign` output committed under `fixtures/`. A macOS CI job regenerates the fixtures and runs `codesign --verify --deep --strict` on signed outputs.
3. **Data over hardcoding.** Release sources, anisette servers, Apple endpoints, themes and error recovery actions are typed data (validated by zod), not literals scattered in code.
4. **Streams, not buffers.** IPAs are read and written as streams (zip.js). Only individual Mach-O slices are fully buffered for signing.
5. **Explicit state machines for flows.** Every long operation is a pipeline with visible steps. The UI renders the pipeline. It never invents its own progress logic.
6. **Secrets are capabilities.** Passwords and private keys only move through the `SecretStore` port. Logs redact by default.
7. **Styling without CSS.** UI is HeroUI components plus Tailwind utility classes. Palettes are TS objects applied as HeroUI theme variables at runtime. The only stylesheet is the single required Tailwind/HeroUI entry import.

## Code Organization Note

- **New Features:** all code follows this document. A new platform means new adapters in a new `apps/*` composition root. Nothing changes in `packages/`.
- **Spike code:** an early signer prototype was reference material only. `packages/signer` re-implements it with tests.
- **Interoperability:** third-party protocol knowledge (libimobiledevice docs, SideStore, rcodesign, zsign) is used as specification. Code is never copied from GPL/AGPL/proprietary sources (ldid, ipa-resign) or from other sideloading tools.

## Code Examples

### A port in a context, an adapter in a shell

```ts
// packages/device/src/domain/ports/types.ts: the context only knows the interface
export type Connection = {
  read(): Promise<Uint8Array | null>
  write(bytes: Uint8Array): Promise<void>
  /** Upgrade in place; the adapter authenticates the device by pinning its certificate. */
  startTls(credentials: TlsCredentials): Promise<void>
  close(): Promise<void>
}

export type DeviceTransport = {
  connectUsbmux(): Promise<Connection>
}
```

```ts
// apps/desktop/src/main/adapters/usbmux-transport.ts: the only place that touches node:net
export const createNodeUsbmuxTransport = (
  endpoint = resolveUsbmuxdEndpoint()
): DeviceTransport => ({
  connectUsbmux: async () => createNodeConnection(await open(endpoint))
})

// apps/desktop composition root
const devices = createDeviceManager({
  transport: createNodeUsbmuxTransport(),
  secrets,
  logger
})
```

### A pipeline flow in the installer (application layer)

```ts
// packages/installer/src/flows/install-sidestore.ts
import { pipeline, step } from '../pipeline'

export const installSideStore = pipeline('installSideStore', [
  step(
    'resolveRelease',
    { weight: 1, labelKey: 'install.steps.resolve' },
    ({ catalog }, input: { channel: Channel }) =>
      catalog.resolveRelease('sidestore', input.channel)
  ),
  step(
    'download',
    { weight: 3, labelKey: 'install.steps.download', idempotent: true },
    ({ catalog }, release) => catalog.download(release)
  ),
  step(
    'provision',
    { weight: 2, labelKey: 'install.steps.provision' },
    ({ apple, device }, ipa) => apple.provisionApp(ipa.manifest, device.info)
  ),
  step(
    'sign',
    { weight: 2, labelKey: 'install.steps.sign' },
    ({ signer }, provisioned) =>
      signer.signIpa(
        provisioned.ipa,
        provisioned.identity,
        provisioned.profiles
      )
  ),
  step(
    'install',
    { weight: 4, labelKey: 'install.steps.install' },
    ({ device }, signed) => device.installApp(signed)
  ),
  step(
    'placePairing',
    { weight: 1, labelKey: 'install.steps.pairing' },
    ({ device }, installed) => device.placePairingFile(installed.bundleId)
  )
])
```

### Errors are codes, the UI decides presentation

```ts
// packages/kernel/src/errors/codes.ts
export const ErrorCode = {
  DeviceLocked: 'device.locked',
  DeveloperModeOff: 'device.developer_mode_off',
  AppIdQuotaExceeded: 'apple.app_id_quota',
  CertificateLimit: 'apple.certificate_limit',
  AnisetteUnavailable: 'apple.anisette_unavailable',
  ReleaseSourceGone: 'catalog.source_gone',
  NoInternet: 'net.offline'
} as const
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export class LoadstarError extends Error {
  constructor(
    readonly code: ErrorCode,
    options?: { cause?: unknown; data?: Record<string, unknown> }
  ) {
    super(code, { cause: options?.cause })
  }
}
```

### Theme palettes as data (no CSS files)

```ts
// packages/ui/src/theme/palettes/palettes.ts
export const palettes = {
  graphite: {
    light: { accent: 'oklch(0.55 0.02 260)', background: 'oklch(0.99 0 0)' },
    dark: { accent: 'oklch(0.75 0.02 260)', background: 'oklch(0.16 0.01 260)' }
  },
  ocean: {
    light: {
      accent: 'oklch(0.58 0.15 240)',
      background: 'oklch(0.99 0.005 240)'
    },
    dark: { accent: 'oklch(0.72 0.13 230)', background: 'oklch(0.17 0.03 245)' }
  }
  // aurora, sunset, forest, rose …
} satisfies Record<string, Record<'light' | 'dark', PaletteTokens>>
```

## Anti-Patterns

- ❌ `if (isElectron) … else …` inside `packages/`. Platform branching belongs in composition roots.
- ❌ Hardcoded release asset URLs (`…/releases/latest/download/X.ipa` breaks when upstream renames or deletes an asset or repository; LiveContainer's repo 404s as of 2026-10-13).
- ❌ Swallowing a raw error into a generic "Something went wrong". Classify it into an `ErrorCode` or add one.
- ❌ Buffering whole IPAs in memory. Stream them from disk or the download.
- ❌ UI components computing progress or retry logic. That's the pipeline's job.
- ❌ Writing `.css` files or `style={{}}` for theming. Use HeroUI props, Tailwind utilities and palette tokens.
- ❌ Copying code from other sideloading tools, ldid (AGPL) or ipa-resign (proprietary license).

[← Engine RPC](rpc.md) · [Back to README](../README.md) · [Roadmap →](roadmap.md)

# The User Interface

`@loadstar/ui` is the React app the desktop shell renders: React 19, HeroUI v3, Tailwind v4, TanStack Router and Query, and Lucide icons. It is a package like the others. It can import only `@loadstar/kernel` and `@loadstar/rpc`, and it never reaches a device, Apple or the file system on its own. The host gives it everything it needs.

## Running it in a browser

The UI runs without Electron. The package is a plain Vite app: `index.html` and `vite.config.ts` sit at the package root, and `src/main.tsx` mounts `App` with the browser services.

```sh
pnpm --filter @loadstar/ui dev      # http://localhost:5173, hot reload
pnpm --filter @loadstar/ui build    # production build into packages/ui/dist
pnpm --filter @loadstar/ui preview  # serve the build
```

In development it logs at debug level to the browser console; a production build logs from `info` up. Preferences are kept in `localStorage`. The top bar pickers are placeholders until the Engine client is connected.

## Folder structure

```
packages/ui/
├── index.html  vite.config.ts  vitest.config.ts  tsconfig*.json
└── src/
    ├── main.tsx        # browser entry: createBrowserServices, then <App/>
    ├── App.tsx         # providers (services, query cache, theme) + router; what every host mounts
    ├── router.tsx      # code-based routes, one per section
    ├── sections.ts     # sidebar sections and groups, in display order
    ├── styles.css      # the only stylesheet: Tailwind, then HeroUI
    ├── index.ts        # public API
    ├── components/     # the shell (app-shell, top-bar, sidebar, …) and shared pieces
    ├── features/       # one folder per section: install, preload, devices, accounts, certificates, logs, settings
    ├── hooks/          # useTheme, useUiServices
    ├── services/       # what the UI gets from its host, and its browser and in-memory implementations
    ├── theme/          # palettes, applyPalette, the theme store and provider
    └── locales/        # the temporary English shell strings (replaced by i18next JSON in 6b)
```

The package exports `App`, the service types and factories, the palettes and the theme types from `@loadstar/ui`, and the stylesheet from `@loadstar/ui/styles.css`.

## What a host provides

`services/` holds the things the UI gets from its host, swapped per environment: the browser, the Electron renderer, tests. `App` takes them as a `UiServices` object, and they are the only way the UI reaches its host:

| Service | Purpose | Browser implementation |
|---|---|---|
| `Logger` (kernel) | Structured logs. `App` scopes them to `ui`, and features add `ui.theme`, `ui.router` and so on | `createLogger` with `consoleLogSink` |
| `PreferencesStore` | Synchronous `read`/`write` of UI preferences (palette, colour mode) | `createLocalStoragePreferences`, under keys prefixed `loadstar.` |
| `ColorSchemeSource` | The OS light/dark preference, and when it changes | `createMediaColorSchemeSource(matchMedia)` |

`createBrowserServices(window, logLevel)` builds all three. `App` touches no browser global when it is imported, so the Electron renderer can mount `<App services={…}/>` with its own services and history. Tests use `createMemoryPreferencesStore()` and a fixed or controllable colour-scheme source.

## Themes and palettes

There are six palettes: **Graphite** (the default), **Ocean**, **Aurora**, **Sunset**, **Forest** and **Rose**. Each has a light and a dark variant. They are TypeScript data in `src/theme/palettes.ts`: a fixed set of oklch tokens (`accent`, `background`, `surface`, `muted`, `border`, …), checked against `PaletteTokens` for every palette and both schemes.

`applyPalette` writes the tokens to `<html>` as HeroUI's CSS variables (`--accent`, `--background`, `--surface-secondary`, …). It also sets the `light`/`dark` class and `data-theme`, so HeroUI's own dark defaults (shadows, `color-scheme`) follow. HeroUI derives hover, soft and secondary border shades from these with `color-mix()`, so a palette only defines base colours.

The colour mode is `system`, `light` or `dark`. In `system` mode the theme follows the OS and switches live when the OS does. Palette and mode are saved through `PreferencesStore` and can be changed under **Settings → Appearance**. Each change is logged at debug level under `ui.theme`.

To add a palette, add its id to `paletteIds`, add its tokens to `palettes.ts` and add a label. The tests then check that it has every token in both schemes.

## The shell

- A **top bar** across the window (`header`): the app name on the start side, then two pickers on the end side, **Device** and **Apple ID**. Each is a menu button with a status dot, a label and the current value ("None", "Not signed in"). For now each menu holds one disabled placeholder item; real devices and accounts come with the Engine client.
- A **sidebar** (`nav`) on the start edge. **Install** and **Preload** come first; after a separator, a **Manage** group holds **Devices**, **Accounts**, **Certificates**, **Logs** and **Settings**. The current section has `aria-current="page"`, and the highlight is styled from that attribute.
- The current page in `main`. **Install** is the home page.

The first Tab stop is a **Skip to content** link, which is visible only when focused. After it come the two top bar pickers, then the sidebar links in display order, then the page. Every control is reachable and usable from the keyboard: a picker opens with Enter, Space or the arrow keys and closes with Escape.

Routes are code-based (TanStack Router) in `src/router.tsx`: `/` redirects to `/install`, and there is one route per section in `src/sections.ts`, each with a page under `src/features/<section>/`. A section's `group` decides where the sidebar shows it. Each navigation is logged at debug level under `ui.router`.

## Styling rules

- **No CSS files.** The only stylesheet is `src/styles.css`, which imports Tailwind and then HeroUI. Everything else uses HeroUI components and Tailwind utilities.
- **No `style={{}}` for theming.** Colours come from the palette variables through utilities such as `bg-accent-soft`, `text-muted` and `border-border`.
- **Logical utilities only:** `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `border-s`/`border-e`, never `ml-`/`left-`. The layout then mirrors in right-to-left languages without changes.
- **No string literals in JSX.** Shell labels currently go through a small `t()` over an English map (`src/locales/en-shell.ts`). The i18next setup that replaces it keeps the same keys.

## Related

- [Architecture](architecture.md): packages and dependency rules
- [Install Flows](install-flows.md): the Engine flows the UI drives

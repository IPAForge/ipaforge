[← Engine RPC](rpc.md) · [Back to README](../README.md) · [Roadmap →](roadmap.md)

# The User Interface

`@loadstar/ui` is the React app the desktop shell renders: React 19, HeroUI v3, Tailwind v4, TanStack Router and Query, and Lucide icons. It is a package like the others. It can import only `@loadstar/kernel` and `@loadstar/rpc`, and it never reaches a device, Apple or the file system on its own. The host gives it everything it needs.

## Running it in Electron

```sh
pnpm --filter @loadstar/desktop dev      # opens the app in Electron, hot reload
pnpm --filter @loadstar/desktop build    # main, preload and renderer into apps/desktop/out
```

`apps/desktop/src/renderer/main.tsx` mounts `App` the same way as the browser entry: with `createBrowserServices` and `prepareLanguage` (see [Loading languages](#loading-languages)), since the renderer is a sandboxed browser context, and with a hash history, because a build is loaded from `file://`. The window runs with `contextIsolation`, `sandbox` and no Node integration, under a strict Content-Security-Policy, and it blocks new windows and navigation. The preload exposes nothing the UI uses yet; it will carry only the rpc port once the Engine is wired.

## Running it in a browser

The UI also runs without Electron. The package is a plain Vite app: `index.html` and `vite.config.ts` sit at the package root, and `src/main.tsx` mounts `App` with the browser services once `prepareLanguage` has loaded the language.

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
    ├── hooks/          # useTheme, useUiServices, useLanguage, useFormat
    ├── services/       # what the UI gets from its host, and its browser and in-memory implementations
    ├── theme/          # palettes, applyPalette, the theme store and provider
    ├── locales/        # one JSON file per language (en.json is the source of truth) and status.json
    └── utils/i18n/     # i18next setup, typed keys, language matching and store, pseudo-locale, formatters
```

The package exports `App`, the service types and factories, the palettes and the theme types from `@loadstar/ui`, and the stylesheet from `@loadstar/ui/styles.css`.

## What a host provides

`services/` holds the things the UI gets from its host, swapped per environment: the browser, the Electron renderer, tests. `App` takes them as a `UiServices` object, and they are the only way the UI reaches its host:

| Service | Purpose | Browser implementation |
|---|---|---|
| `Logger` (kernel) | Structured logs. `App` scopes them to `ui`, and features add `ui.theme`, `ui.router` and so on | `createLogger` with `consoleLogSink` |
| `PreferencesStore` | Synchronous `read`/`write` of UI preferences (palette, colour mode, language) | `createLocalStoragePreferences`, under keys prefixed `loadstar.` |
| `ColorSchemeSource` | The OS light/dark preference, and when it changes | `createMediaColorSchemeSource(matchMedia)` |
| `LocaleSource` | The OS's preferred languages, most preferred first | `createNavigatorLocaleSource(navigator)` |

`createBrowserServices(window, logLevel)` builds all four. `App` touches no browser global when it is imported, so the Electron renderer can mount `<App services={…} language={…}/>` with its own services and history. Tests use `createMemoryPreferencesStore()`, a fixed or controllable colour-scheme source and `createFixedLocaleSource([...])`.

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

## Translations

Every visible string goes through i18next with ICU MessageFormat (`i18next`, `react-i18next`, `i18next-icu`). Components call `const { t } = useTranslation()` and render `t("nav.install")`; nothing else puts text on screen.

### Locale files

`src/locales/` holds one JSON file per language, nested by feature: `en.json`, `de.json`, `ro.json`, `ru.json`, `ar.json` and `ja.json`. **`en.json` is the source of truth**: every other file has exactly its keys. Messages are ICU:

```json
"devicesFound": "{count, plural, =0 {No devices yet} one {# device connected} other {# devices connected}}"
```

English is bundled; every other language is its own chunk, loaded on demand (see [Loading languages](#loading-languages)). A message that is missing or empty in a language falls back to English. In development a key that exists nowhere logs a warning under `ui.i18n`; a language change logs at info level.

### Adding a string

1. Add the key to `en.json`, in the group of the feature that uses it.
2. Use it: `t("settings.language.hint")`, or `t("topBar.devicesFound", { count })` for an ICU argument.
3. Add the key to every other locale file, translated if you can. Otherwise leave it as an empty string: it shows English and counts as untranslated until a translator fills it in.
4. Run `pnpm check:locales`.

`t()` is typed against `en.json`, so a typo or a key missing from it is a type error. The keys for the Engine's data are required: every `ErrorCode` has `errors.<code>.title` and `errors.<code>.body`, every recovery action `recovery.<id>`, and every step label (`install.steps.*`, `pairing.steps.*`) its key. `src/utils/i18n/required-keys.ts` turns a missing one into a type error that names it, and a test checks the same keys in every shipped language. A new `ErrorCode` therefore fails `pnpm typecheck` until it has English text. `ErrorCode` comes from `@loadstar/kernel`; `RecoveryAction` and `StepLabel` come through `@loadstar/rpc`.

### Adding a language

Nothing needs registering beyond the JSON file and `status.json`: the build picks up every `src/locales/*.json` as its own chunk.

1. Copy `en.json` to `<code>.json` (a BCP 47 code such as `fr` or `pt-BR`) and translate it.
2. Add `"<code>": "draft"` to `src/locales/status.json`.
3. If the language is written right to left and isn't Arabic, Hebrew, Persian or Urdu, add it to `RTL_LANGUAGES` in `src/utils/i18n/languages.ts`.

### Drafts and completion

`status.json` gives every language a status: `source` (English), `draft` or `reviewed`. Machine-drafted translations start as `draft`, and the language picker shows a small "draft" label next to them. A language loses the label only when a native speaker has reviewed the whole file and sets it to `reviewed`. Today every language except English is a draft.

`pnpm check:locales` (`scripts/check-locales.ts`, part of `pnpm verify` and CI) fails on:

- a language listed in `status.json` without a file, or a file not listed there, or an unknown status;
- a key missing from a language, or a key `en.json` doesn't have;
- a message that isn't valid ICU (including a plural or select without `other`);
- a message whose arguments differ from English in name or type (`{name}` vs `{nombre}`, `{count, plural}` vs `{count}`).

It then prints each language's completion: the share of `en.json`'s keys with a non-empty message.

### Which language is shown

`LocaleSource` gives the OS's preferred languages; the browser implementation reads `navigator.languages`, and the Electron renderer can supply `app.getPreferredSystemLanguages()` through the same service. `matchLocale` picks the best shipped language: for each preferred tag in order, an exact match, then the same tag with fewer subtags (`ar-EG` → `ar`, `zh-Hant-HK` → `zh-Hant` → `zh`). With no match it falls back to English.

Under **Settings → Language** the user can follow the system (the option reads "System (Deutsch)", naming the detected language) or pick one. Each language is listed in its own name (Deutsch, العربية, 日本語). The choice is saved through `PreferencesStore` under `language` and overrides the system language. Changes apply as soon as the language has loaded, without a restart.

### Right-to-left languages

The active locale sets `<html lang dir>`; Arabic, Hebrew, Persian and Urdu are `rtl`. React Aria (under HeroUI) gets the same locale through its `I18nProvider`, so its components and keyboard handling follow the direction too. To keep layouts mirroring:

- use only logical utilities (`ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `border-s`/`border-e`, `text-start`); add `rtl:` variants only for what logical utilities can't express;
- wrap icons that point along the reading direction (a "next" chevron, a "back" arrow) in `<MirroredIcon icon={ChevronRight} />`, which flips them in RTL. Icons that don't point along the text (the down chevron of a menu, a phone) stay as they are; the shell has none that need mirroring today;
- mark text in another language with `lang` (the language picker does this for each language's name).

### Formatting

`useFormat()` returns `date`, `dateTime`, `number`, `list` and `relativeTime` for the language shown, built on the standard `Intl` APIs and memoised per locale. Never format dates or numbers by hand or with `toString()`.

### The pseudo-locale

Development builds (`pnpm --filter @loadstar/ui dev`, `pnpm --filter @loadstar/desktop dev`, and tests) also offer `en-XA` in the language picker. It is generated from `en.json` when it is first chosen: every letter accented, the text padded to about 40 % longer and wrapped in brackets, `[Îñšţåļļ~~~]`. ICU arguments, plural branches and `#` are left intact. Text without accents is hard-coded; text without its closing bracket is truncated. Production builds don't include it.

### Loading languages

English is part of the main bundle: it is the fallback and the source of the key types. Every other file in `src/locales/` (except `status.json`) is collected by `import.meta.glob` in `src/utils/i18n/locale-bundles.ts` and becomes its own chunk, about 20–30 kB each, fetched with a dynamic `import()` the first time the language is shown. The dev-only pseudo-locale and the ICU parser it needs load the same way.

- **Startup.** A host calls `await prepareLanguage(services)` before it renders. It resolves the language (the saved choice, else the best match for the OS languages), loads that bundle, and returns a `LanguageSetup`, which the host passes to `<App language={…}/>`. The first render is already in that language, so English never flashes. Both `src/main.tsx` and the Electron renderer do this.
- **Switching.** `choose` (behind the Language select) loads the bundle first, then changes the language and saves the choice. Until then the current language, and the select's value, stay as they are. If several choices are made quickly, only the last one applies.
- **Caching.** A bundle loads once per session; concurrent requests share one fetch.
- **Failures.** If a bundle can't load, a warning is logged under `ui.i18n` and nothing changes; choosing it again retries. At startup the app falls back to English (following the system) without overwriting the saved choice.
- **Timing.** Each load logs `language bundle loaded` at debug level under `ui.i18n` with its duration in `ms`.

Tests call `await renderApp(path, { languages, preferences, load })`, which runs `prepareLanguage` like a host; `load` replaces the bundle loader to delay or fail a language.

## Styling rules

- **No CSS files.** The only stylesheet is `src/styles.css`, which imports Tailwind and then HeroUI. Everything else uses HeroUI components and Tailwind utilities.
- **No `style={{}}` for theming.** Colours come from the palette variables through utilities such as `bg-accent-soft`, `text-muted` and `border-border`.
- **Logical utilities only:** `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `border-s`/`border-e`, never `ml-`/`left-`. The layout then mirrors in right-to-left languages without changes.
- **No string literals in JSX.** Text and user-visible props (`aria-label`, `title`, `placeholder`, `label`, `alt`) come from `t()`. The Biome plugin `tooling/biome/no-jsx-literal-text.grit` fails lint on JSX text with a letter in it and on string literals in those props, in `src/**/*.tsx`.

## Related

- [Architecture](architecture.md): packages and dependency rules
- [Install Flows](install-flows.md): the Engine flows the UI drives

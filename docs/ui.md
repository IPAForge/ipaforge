[← Engine RPC](rpc.md) · [Back to README](../README.md) · [Roadmap →](roadmap.md)

# The User Interface

`@loadstar/ui` is the React app the desktop shell renders: React 19, HeroUI v3, Tailwind v4, TanStack Router and Query, and Lucide icons. It is a package like the others. It can import only `@loadstar/kernel` and `@loadstar/rpc`, and it never reaches a device, Apple or the file system on its own. The host gives it everything it needs.

## Running it in Electron

```sh
pnpm --filter @loadstar/desktop dev      # opens the app in Electron, hot reload
pnpm --filter @loadstar/desktop build    # main, preload and renderer into apps/desktop/out
```

`apps/desktop/src/renderer/main.tsx` mounts `App` the same way as the browser entry: with `createBrowserServices` and `prepareLanguage` (see [Loading languages](#loading-languages)), since the renderer is a sandboxed browser context, and with a hash history, because a build is loaded from `file://`. The window runs with `contextIsolation`, `sandbox` and no Node integration, under a strict Content-Security-Policy, and it blocks new windows and navigation. A page the UI asks to open (`window.open`) goes to the default browser only when it is on the allowed list in `apps/desktop/src/main/constants.ts` (a new Loadstar issue on GitHub, Apple's account and developer pages); anything else is blocked and logged. The main process serves the Engine over a `MessageChannelMain` (one per page load); the preload only forwards the other end of it to the page, which wraps it in a `Transport` for `createEngineClient`. Nothing else is exposed to the page.

## Running it in a browser

The UI also runs without Electron. The package is a plain Vite app: `index.html` and `vite.config.ts` sit at the package root, and `src/main.tsx` mounts `App` with the browser services once `prepareLanguage` has loaded the language.

```sh
pnpm --filter @loadstar/ui dev      # http://localhost:5180, hot reload
pnpm --filter @loadstar/ui build    # production build into packages/ui/dist
pnpm --filter @loadstar/ui preview  # serve the build
```

In development it logs at debug level to the browser console; a production build logs from `info` up. Preferences are kept in `localStorage`. Without Electron there is no real Engine: `src/main.tsx` connects a fake one (`src/services/engine/fake/`) over the rpc memory transport. In development `?scenario=<id>` picks what it plays (`happy`, `hot-plug`, `devices`, `accounts`, `no-accounts`, `sign-in-no-2fa`, `wrong-password`, `two-factor`, `two-teams`, `certificate-limit`, `free-app-limit`, `retry`, and the failures `device-locked`, `app-id-quota`, `profile-banned`, `offline`, `checksum`, `unsupported-ios`, `anisette`, and `logs`, which fills the log buffer with 3,000 lines to try paging, search and the virtual list); tests use the same fake. The fake keeps its own log buffer, and logs its runs and devices the way the real Engine does. The `hot-plug` scenario plugs the fake iPad in and out every 5 s. The `devices` scenario shows every device state: the iPhone on USB and Wi-Fi (ready, with `studio@` blocked on it), a locked iPad (unlocked on a later read), and an iPhone SE that doesn't trust this computer (**Ask again** pairs it, then its Developer Mode is off).

To try **Add Apple ID** in the browser: any Apple ID and password; Apple then asks where to send the code (a trusted device or a text message) and the code is `123456` (any other code is wrong and asked again). `?scenario=sign-in-no-2fa` signs in without a second factor, `?scenario=wrong-password` fails with `apple.invalid_credentials`.

The saved Apple IDs are `work@example.com` (one free team) and `studio@example.com` (a free and a paid team). `?scenario=accounts` adds `old@example.com`, whose session expired, and has Apple block `studio@` on the fake iPhone; `?scenario=no-accounts` starts with none. Signing out works in every scenario.

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
    ├── features/       # one folder per section: install, preload, devices, accounts, certificates, logs, settings;
    │                   #   the page at its root, then components/, hooks/, utils/, constants.ts, types.ts as needed
    ├── state/          # stores kept outside components: active-run/ (the install run), selection/ (device and Apple ID in use)
    ├── hooks/          # useTheme, useUiServices, useLanguage, useFormat, useEngine, useRun (use-run.ts), useSelection (use-selection.ts); queries/ (Engine query hooks)
    ├── services/       # what the UI gets from its host: preferences/, system/ (OS colour scheme, languages, clipboard, opening links), logging/, engine/ (request logging, the fake Engine)
    ├── theme/          # palettes/ (data + applying them), store/, provider/
    ├── locales/        # one JSON file per language (en.json is the source of truth) and status.json
    └── i18n/           # setup/, languages/, loading/, provider/, plus formatters, pseudo-locale, required keys
```

The package exports `App`, the service types and factories, the palettes and the theme types from `@loadstar/ui`, and the stylesheet from `@loadstar/ui/styles.css`.

## What a host provides

`services/` holds the things the UI gets from its host, swapped per environment: the browser, the Electron renderer, tests. `App` takes them as a `UiServices` object, and they are the only way the UI reaches its host:

| Service | Purpose | Browser implementation |
|---|---|---|
| `Logger` (kernel) | Structured logs. `App` scopes them to `ui`, and features add `ui.theme`, `ui.router` and so on. Every record also goes to the Engine's log buffer (`engine.logs.write`), so Logs shows the UI's lines with the Engine's | `createLogger` with `consoleLogSink` (from `logLevel` up) |
| `PreferencesStore` | Synchronous `read`/`write` of UI preferences (palette, colour mode, language) | `createLocalStoragePreferences`, under keys prefixed `loadstar.` |
| `ColorSchemeSource` | The OS light/dark preference, and when it changes | `createMediaColorSchemeSource(matchMedia)` |
| `LocaleSource` | The OS's preferred languages, most preferred first | `createNavigatorLocaleSource(navigator)` |
| `EngineClient` (rpc) | The Engine: queries, runs and `classify`. `App` logs every request at debug level under `ui.engine` (the method, and the code of a failure; never the arguments) | the fake Engine over the memory transport (`createFakeEngineClient`); in Electron, `createEngineClient` over the MessagePort |
| `ClipboardWriter` | Writes text to the clipboard (copied diagnostics, copied log lines) | `createNavigatorClipboard(navigator)` |
| `FileSaver` | Saves text as a file (Save in Logs) | `createDownloadFileSaver`: a download, which Electron saves through the system dialog |
| `LinkOpener` | Opens a web page in the browser (a pre-filled issue, an Apple page) | `createWindowLinkOpener(window)` |
| `appVersion` | The app's version, for diagnostics | the package version, defined by Vite as `import.meta.env.VITE_APP_VERSION` |

`createBrowserServices(window, { logLevel, engine, appVersion })` builds them all; `engine` is a function that gets the logger and returns the host's `EngineClient`. `App` touches no browser global when it is imported, so the Electron renderer can mount `<App services={…} language={…}/>` with its own services and history. Tests use `createMemoryPreferencesStore()`, a fixed or controllable colour-scheme source, `createFixedLocaleSource([...])`, `createMemoryClipboard()`, `createMemoryFileSaver()` and the fake Engine with no delay (`renderApp(path, { scenario })`).

## Engine queries

Components reach the Engine only through the TanStack Query hooks in `src/hooks/queries/`: `useDevices` (one entry per device), `useDeviceStatus`, `useAccounts`, `useTeams`, `useCatalogApps`, `useRecommendedChannel`, `useAppIdQuota`, `useCertificates` and `usePlanInstall`, plus the mutation `useSignOut` (`use-sign-out.ts`). Their cache keys live in one module, `query-keys.ts`, with every account query under `['accounts', …]` so one invalidation refreshes them all. A hook whose input is not known yet (no device picked) waits instead of asking. Failures arrive as `LoadstarError`s with their code.

### Live data: push, not polling

- **Live state comes from push events.** Devices come from the Engine's device feed (usbmuxd `Listen`, `engine.watchDevices`): `App` mounts `DeviceFeed` (`useDeviceFeed`), which writes every new list into the `devices` query and reads a device's status again when it comes or goes, so plugging a device in or out shows at once. Installs stream their run events, and Logs gets each new line from the Engine's log feed (`engine.logs.watch`). Local data such as accounts gets a store-change stream when that lands.
- **Polling only as a fallback** where no event source exists: slow, and only while the UI is waiting for something (for example "unlock the device" during a step), then it stops. The Engine itself falls back to reading the device list every 30 s only when usbmuxd refuses `Listen`.
- **Apple and network data** (teams, certificates, the App ID quota, the catalog) is fetched **on demand and cached**: when a screen needs it or right before an install, plus an explicit Refresh.
- **No `refetchInterval`**, and no refetch on window focus or reconnect for queries that reach Apple or GitHub.

The query client (`hooks/queries/query-client.ts`) sets these defaults for every query: `retry: false` (an Engine error is a catalogued answer, not a glitch), a `staleTime` of 5 minutes, `refetchOnWindowFocus: false` and `refetchOnReconnect: false`. The `devices` query never goes stale (`staleTime: Infinity`); the feed keeps it current.

## Themes and palettes

There are six palettes: **Graphite** (the default), **Ocean**, **Aurora**, **Sunset**, **Forest** and **Rose**. Each has a light and a dark variant. They are TypeScript data in `src/theme/palettes/palettes.ts`: a fixed set of oklch tokens (`accent`, `background`, `surface`, `muted`, `border`, …), checked against `PaletteTokens` for every palette and both schemes.

`applyPalette` writes the tokens to `<html>` as HeroUI's CSS variables (`--accent`, `--background`, `--surface-secondary`, …). It also sets the `light`/`dark` class and `data-theme`, so HeroUI's own dark defaults (shadows, `color-scheme`) follow. HeroUI derives hover, soft and secondary border shades from these with `color-mix()`, so a palette only defines base colours.

The colour mode is `system`, `light` or `dark`. In `system` mode the theme follows the OS and switches live when the OS does. Palette and mode are saved through `PreferencesStore` and can be changed under **Settings → Appearance**. Each change is logged at debug level under `ui.theme`.

To add a palette, add its id to `paletteIds`, add its tokens to `palettes.ts` and add a label. The tests then check that it has every token in both schemes.

## The shell

- A **top bar** across the window (`header`): the app name on the start side, then two pickers on the end side, **Device** and **Apple ID**. Each is a menu button with a status dot, a label and the current value ("None", "Not signed in").

  The **Device** menu (`components/shell/device-picker.tsx`) lists the connected devices, each with a status dot, its model, iOS version and connection (USB, Wi-Fi, or "USB and Wi-Fi" for one device seen both ways, listed once), and its state when it isn't ready: **Checking…**, **Locked**, **Developer Mode off**, **Not trusted**, **Can't read the device** or **Not connected**. The top bar button says the state in words next to the name. Without a choice the first device is in use, a USB one first. Choosing one keeps it under `selection.device`; when it is unplugged it stays in use as **Not connected** (named from its last status) and is used again by itself when it comes back. After a restart a picked device that isn't connected is only remembered until it connects. **Open Devices** goes to the Devices page.

  Nothing about devices is polled. The list comes from the Engine's device feed (usbmuxd `Listen`). A device's status (lock, Developer Mode, trust) is read when it connects, when the Device menu or the Devices page opens, on **Check again**, and by the install run itself; the computer isn't told when a device is unlocked, so the next read shows it. A device coming or going shows a small note (`features/devices/components/device-notes.tsx`, a HeroUI toast), never an error screen.

  The **Devices** page (Manage → Devices) has a card per device: state, model, iOS, connection and UDID, **Use this device**, and for a device that isn't ready what to do: unlock it, the Developer Mode steps, or **Ask again** for Trust (`engine.pairDevice`, which shows the Trust prompt on the device and waits for the tap). The **Install** page shows the same notice for the device in use, a notice when no device is connected, and one when Apple blocked the Apple ID in use on that device, with a button to use another saved Apple ID.

  The **Apple ID** menu lists the saved Apple IDs, each with a status dot, its teams (free or paid) and its state: **Checking…** (muted, until Apple has answered; never shown as fine before that), fine, **Sign-in needed** (its session expired), **Blocked on this device** (Apple banned its profiles on the device in use, known locally so shown at once, and said in words in the top bar) or **Couldn't reach Apple**. When the Apple ID in use needs signing in, the top bar button says so in words next to the Apple ID (the Apple ID is truncated first), and the **Install** page shows a notice with **Sign in again**; installing stays possible, because the run's sign-in step asks for the password. Choosing one makes it the Apple ID in use, kept in `PreferencesStore` under `selection.account` (`state/selection/`). Without a choice, or when the chosen one is gone, the first saved Apple ID is in use. With none saved the menu says so. **Add Apple ID…** opens the sign-in dialog (`features/accounts/sign-in/`), and the new Apple ID becomes the one in use:
  1. The Apple ID and the password. The password goes to the Engine only as the answer to the `signIn` run's password question, never as the run's input.
  2. If Apple asks for a second factor: where to send the code (a trusted device or a text message to one of the account's numbers), then the code. A wrong code asks again and says so. Cancelling goes back to the form.
  The form has **Save my password in the system keychain**, ticked by default. When it is ticked, the password is passed to the Engine's `signIn` as `rememberPassword` and kept only in the encrypted secret store, so an expired session is renewed without asking.
  3. "Signed in as …", then **Done**. The Engine has saved the account, and the accounts query is invalidated (not polled).

  Each step stays on screen while Apple works on its answer: the form (read-only, **Sign in** busy, "Signing in…") until the password is checked, the method choice (the chosen option busy, "Sending the code…") until the code is sent, the code step (**Verify** busy, the code locked, "Checking the code…") until Apple answers. The next step replaces it only when the Engine asks it or the run ends; the waiting text is announced through an `aria-live` region. In the browser dev host the fake Apple takes about 600 ms per answer, so these states show.

  A failure (wrong password, the anisette server down…) shows its code's translated title and body under the form. The question dialogs (`components/prompts/`) are shared with the install run.
- A **sidebar** (`nav`) on the start edge. **Install** and **Preload** come first; after a separator, a **Manage** group holds **Devices**, **Accounts**, **Certificates**, **Logs** and **Settings**. The current section has `aria-current="page"`, and the highlight is styled from that attribute.
- The current page in `main`. **Install** is the home page.

  The **Install** page (`features/install/`), before a run, shows:
  - the device and Apple ID notices (above);
  - **What to install**: SideStore, or LiveContainer + SideStore, each with the App IDs it uses;
  - the **Channel**, Stable or Nightly, with the one the catalog recommends for the device's iOS marked;
  - **This install**, from the Engine's read-only `planInstall`: the App IDs it uses and how many are left this week (and when the next frees), the free-app slots on the device, whether the certificate is reused, and the team. It is read once the device and the Apple ID are ready, and again when the choice changes; never polled;
  - **Install**, which waits only for the device (and an Apple ID that isn't blocked there, with enough App IDs). An expired session doesn't block it: the run asks for the password.

  Pressing Install starts `engine.installSideStore`. The run lives in a store kept by `App` (`state/active-run/`), not in the page, so it goes on in other sections, with a badge on **Install** in the sidebar. Its events are pushed by the Engine and reduced into a view (`utils/reduce-run-event.ts`, one handler per event type, and `run-view.ts`): every step with its state, its progress (download size, an automatic retry) and, once done, what it did (the Engine's `step-detail`, worded by `run/utils/step-report-texts.ts`, one entry per kind: "SideStore 0.7.0 · Stable", "Saved session reused", "Reused the saved certificate", "2 new · 6 left this week"), the overall progress, the question waiting for an answer, and how it ended. The page shows it in one full-width column: the title and progress, a strip with the app, channel, device, Apple ID, App IDs left and the free apps on the device (from the plan the home page read), how it is going or how it ended, then the steps.
  - **Questions** show as dialogs over any section (`features/install/prompts/run-prompt-host.tsx`, one dialog per question in `asked-prompts.ts`). Each has **Cancel install**, which stops the run at that step; **Resume** asks it again. After an answer the dialog stays, its controls read-only and the chosen one busy, until the Engine's next event (`answering` in the run view).
    - **Password** and **second factor**: as in sign-in.
    - **Team**: one click per team, saying what free and paid mean; the Engine remembers the choice for the Apple ID.
    - **Revoke a certificate**: picked in a list, then confirmed with a red **Revoke and continue**. Each certificate says who made it, from the machine name Apple keeps with it (Loadstar elsewhere, SideStore/AltStore, a named computer, unknown), and what revoking it breaks, in amber. One made by Loadstar is suggested and listed first.
    - **Remove an app to make room** (the free-app limit): picked, then confirmed with a red **Remove and continue**.
    - **Share the certificate** with an imported app that looks like SideStore: **Share** or **Don't share**.
    - **Which apps get the pairing file**: a checkbox row per app, all ticked to start, with what each known app does with the file (`pairingAppPurposeKeys`), **Select all** / **Clear all**, and a button that counts them ("Place in 2 apps").
    - A question a newer Engine asks that this version doesn't know offers **Cancel install**.
  - **Ended:** installed, with what to do on the device; cancelled, with **Resume** from the checkpoint (finished steps aren't repeated); failed, with the recovery box (`features/install/recovery/`):
    - the error's title and text (the code itself only in the diagnostics);
    - the fixes the Engine lists for the code (the diagnostics catalogue, via `engine.classify`), in its order: the first as a card with what to do (a sentence, steps, or an Apple page with **Copy**) and its button ("It's on, try again"), the others as buttons;
    - what each fix does is a table in `constants.ts` (`fixes`, one entry per `RecoveryAction`): continue from the checkpoint, ask the device to trust this computer and then continue (`engine.pairDevice`), **Use another Apple ID** (a picker of the saved Apple IDs, without the one that failed or any blocked on the device; the run starts again with the one picked, which becomes the one in use), **Install from Nightly/Stable** (names the other channel and starts again on it), or only explain (no App IDs left, with the date the next one frees from the plan; device support on Windows). Apple pages have **Open** (in the browser) and **Copy**. Fixes whose screen comes in a later phase (another anisette server, another IPA, updating Loadstar, choosing another team) aren't shown yet;
    - Try again isn't offered twice when the first fix already continues the run;
    - where the run continues from, **Copy diagnostics** (the code, step, app version, install choice and device model, never an Apple ID, name or serial), **Back to Install** (to choose another app, channel or Apple ID; the cancelled box has it too), **Show logs** (Logs with only this run's lines, from when it started to when it ended), and **Report the problem**, which opens a new GitHub issue in the browser with the title and diagnostics filled in (`utils/issue-url.ts`); nothing is sent until the user submits it there.

**Manage → Accounts** (`features/accounts/`) lists the saved Apple IDs with their teams and state, marks the one **in use**, and offers **Use**, **Sign in again** (only for an expired session; it opens sign-in with the Apple ID filled in) and **Sign out**. Signing out asks first, in a dialog that says what Loadstar forgets (the Apple ID, its session, its saved password) and what it keeps (its signing certificates, so signing in again reuses them; installed apps keep working until they expire). Signing out the Apple ID in use hands its place to the next saved one. An **Add Apple ID** button opens sign-in.

Accounts are local data, but the Engine's account store has no change feed, so the UI invalidates the accounts query after a sign-in or a sign-out (never on a timer or on focus). Teams come from `listTeams` when the picker or the page shows an Apple ID: one query per account (the same key), so the top bar, the menu and the Accounts page always agree. An expired session is an answer, not a failure: `useTeams` turns `apple.session_expired` into `{ kind: 'sign-in-needed' }` data, which never goes stale and is not asked again when a menu opens, a component mounts or the window gets focus. It changes only when that account signs in or out (both invalidate the account's queries). Other failures are not retried on mount either.

The first Tab stop is a **Skip to content** link, which is visible only when focused. After it come the two top bar pickers, then the sidebar links in display order, then the page. Every control is reachable and usable from the keyboard: a picker opens with Enter, Space or the arrow keys and closes with Escape.

**Manage → Logs** (`features/logs/`) shows what the Engine and the UI logged, newest at the bottom: each line's time, level, area (Install, Device, Apple, Catalog, Signing, Engine, Interface, App, from its scope) and message, and, pressed, its details full width underneath with **Copy line**.

- **Nothing is loaded whole.** The Engine keeps the last 5,000 records in memory (`createLogBuffer`, already redacted by the logger). The page asks for the newest 200 that match (`engine.logs.page`), and the next 200 up when the list nears the top. The list is virtual (`@tanstack/react-virtual`): only the rows on screen and a few around them are rendered, and a row that opens its details is measured as it renders.
- **Filters and search run in the Engine**, next to the buffer: the level (All, Info, Warnings, Errors, each with its count), the area, the text (in the message, the scope and the fields, once typing pauses for 250 ms; matches are marked), and an install run's time span. Active filters show as chips, each removable. The filters live in a store kept by `App` (`state/log-view/`), so they stay when the user leaves Logs and comes back.
- **New lines are pushed** (`engine.logs.watch`), never polled. While the list is at the bottom it follows them; scrolled up, it stays put and counts them, with **N new lines · Jump to latest**. Older pages added above keep the view still.
- **Copy** puts the lines the filters show on the clipboard; **Save…** writes every line kept this session to `loadstar-logs-<date>-<time>.log`. Both read the lines from the Engine first and say how many, and that the logs name the device, apps and team. **Clear** empties the view only.
- **Include debug details** has the Engine record debug lines too (`engine.logs.setLevel`), until the app restarts.
- **Ctrl+L** (⌘L on macOS) opens Logs from any section, and goes back from Logs (`features/logs/hooks/use-logs-shortcut.ts`, mounted by the shell); <kbd>/</kbd> focuses the search.

Routes are code-based (TanStack Router) in `src/router.tsx`: `/` redirects to `/install`, and there is one route per section in `src/sections.ts`, each with a page under `src/features/<section>/`. A section's `group` decides where the sidebar shows it. Each navigation is logged at debug level under `ui.router`.

## Translations

Every visible string goes through i18next with ICU MessageFormat (`i18next`, `react-i18next`, `i18next-icu`). Components call `const { t } = useTranslation()` and render `t("nav.install")`; nothing else puts text on screen.

### Locale files

`src/locales/` holds one JSON file per language, nested by feature: `en.json`, `de.json`, `ro.json`, `ru.json`, `ar.json` and `ja.json`. **`en.json` is the source of truth**: every other file has exactly its keys. Messages are ICU:

```json
"connected": "{count, plural, =0 {Engine connected · no devices} one {Engine connected · # device} other {Engine connected · # devices}}"
```

English is bundled; every other language is its own chunk, loaded on demand (see [Loading languages](#loading-languages)). A message that is missing or empty in a language falls back to English. In development a key that exists nowhere logs a warning under `ui.i18n`; a language change logs at info level.

### Adding a string

1. Add the key to `en.json`, in the group of the feature that uses it.
2. Use it: `t("settings.language.hint")`, or `t("devices.engine.connected", { count })` for an ICU argument.
3. Add the key to every other locale file, translated if you can. Otherwise leave it as an empty string: it shows English and counts as untranslated until a translator fills it in.
4. Run `pnpm check:locales`.

`t()` is typed against `en.json`, so a typo or a key missing from it is a type error. The keys for the Engine's data are required: every `ErrorCode` has `errors.<code>.title` and `errors.<code>.body`, every recovery action `recovery.<id>`, and every step label (`install.steps.*`, `pairing.steps.*`) its key. `src/i18n/required-keys.ts` turns a missing one into a type error that names it, and a test checks the same keys in every shipped language. A new `ErrorCode` therefore fails `pnpm typecheck` until it has English text. `ErrorCode` comes from `@loadstar/kernel`; `RecoveryAction` and `StepLabel` come through `@loadstar/rpc`.

### Adding a language

Nothing needs registering beyond the JSON file and `status.json`: the build picks up every `src/locales/*.json` as its own chunk.

1. Copy `en.json` to `<code>.json` (a BCP 47 code such as `fr` or `pt-BR`) and translate it.
2. Add `"<code>": "draft"` to `src/locales/status.json`.
3. If the language is written right to left and isn't Arabic, Hebrew, Persian or Urdu, add it to `RTL_LANGUAGES` in `src/i18n/languages/languages.ts`.

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

English is part of the main bundle: it is the fallback and the source of the key types. Every other file in `src/locales/` (except `status.json`) is collected by `import.meta.glob` in `src/i18n/loading/locale-bundles.ts` and becomes its own chunk, about 20–30 kB each, fetched with a dynamic `import()` the first time the language is shown. The dev-only pseudo-locale and the ICU parser it needs load the same way.

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
- **No string literals in JSX.** Text and user-visible props (`aria-label`, `aria-description`, `aria-placeholder`, `aria-roledescription`, `aria-valuetext`, `title`, `placeholder`, `label`, `alt`) come from `t()`. The Biome plugin `tooling/biome/no-jsx-literal-text.grit` fails lint on JSX text with a letter in it and on string literals in those props, in `src/**/*.tsx`.

## Related

- [Architecture](architecture.md): packages and dependency rules
- [Install Flows](install-flows.md): the Engine flows the UI drives

[← Engine RPC](rpc.md) · [Back to README](../README.md) · [Roadmap →](roadmap.md)

# The User Interface

`@ipaforge/ui` is the React app the desktop shell renders: React 19, HeroUI v3, Tailwind v4, TanStack Router and Query, and Lucide icons. It is a package like the others. It can import only `@ipaforge/kernel` and `@ipaforge/rpc`, and it never reaches a device, Apple or the file system on its own. The host gives it everything it needs.

## Running it in Electron

```sh
pnpm --filter @ipaforge/desktop dev      # opens the app in Electron, hot reload
pnpm --filter @ipaforge/desktop build    # main, preload and renderer into apps/desktop/out
```

`apps/desktop/src/renderer/main.tsx` mounts `App` the same way as the browser entry: with `createBrowserServices` and `prepareLanguage` (see [Loading languages](#loading-languages)), since the renderer is a sandboxed browser context, and with a hash history, because a build is loaded from `file://`. The window runs with `contextIsolation`, `sandbox` and no Node integration, under a strict Content-Security-Policy, and it blocks new windows and navigation. A page the UI asks to open (`window.open`) goes to the default browser only when it is on the allowed list in `apps/desktop/src/main/constants.ts` (a new IPAForge issue on GitHub, Apple's account and developer pages); anything else is blocked and logged. The main process serves the Engine over a `MessageChannelMain` (one per page load); the preload forwards the other end of it to the page, which wraps it in a `Transport` for `createEngineClient`. The preload gives the page one function besides (`window.ipaforgeFiles.pathOf`, `apps/desktop/src/preload/expose-file-paths.ts`): the path of a file the user dropped on the window, from Electron's `webUtils.getPathForFile`, for the Preload page. It opens and reads nothing, and returns nothing for any other file. Nothing else is exposed to the page.

## Running it in a browser

The UI also runs without Electron. The package is a plain Vite app: `index.html` and `vite.config.ts` sit at the package root, and `src/main.tsx` mounts `App` with the browser services once `prepareLanguage` has loaded the language.

```sh
pnpm --filter @ipaforge/ui dev      # http://localhost:5180, hot reload
pnpm --filter @ipaforge/ui build    # production build into packages/ui/dist
pnpm --filter @ipaforge/ui preview  # serve the build
```

In development it logs at debug level to the browser console; a production build logs from `info` up. Preferences are kept in `localStorage`. Without Electron there is no real Engine: `src/main.tsx` connects a fake one (`src/services/engine/fake/`) over the rpc memory transport. In development `?scenario=<id>` picks what it plays (`happy`, `hot-plug`, `devices`, `accounts`, `no-accounts`, `sign-in-no-2fa`, `wrong-password`, `two-factor`, `two-teams`, `certificate-limit`, `free-app-limit`, `retry`, and the failures `device-locked`, `app-id-quota`, `profile-banned`, `offline`, `checksum`, `unsupported-ios`, `anisette`, and `logs`, which fills the log buffer with 3,000 lines to try paging, search and the virtual list); tests use the same fake. The fake keeps its own log buffer, and logs its runs and devices the way the real Engine does. The `hot-plug` scenario plugs the fake iPad in and out every 5 s. The `devices` scenario shows every device state: the iPhone on USB and Wi-Fi (ready, with `studio@` blocked on it), a locked iPad (unlocked on a later read), and an iPhone SE that doesn't trust this computer (**Ask again** pairs it, then its Developer Mode is off).

To try **Add Apple ID** in the browser: any Apple ID and password; the code step follows (as if Apple showed a code on your devices), with **Send a new code** and **Text** a number instead, and the code is `123456` (any other code is wrong and asked again). `?scenario=sign-in-no-2fa` signs in without a second factor, `?scenario=wrong-password` fails with `apple.invalid_credentials`.

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

The package exports `App`, the service types and factories, the palettes and the theme types from `@ipaforge/ui`, and the stylesheet from `@ipaforge/ui/styles.css`.

## What a host provides

`services/` holds the things the UI gets from its host, swapped per environment: the browser, the Electron renderer, tests. `App` takes them as a `UiServices` object, and they are the only way the UI reaches its host:

| Service | Purpose | Browser implementation |
|---|---|---|
| `Logger` (kernel) | Structured logs. `App` scopes them to `ui`, and features add `ui.theme`, `ui.router` and so on. Every record also goes to the Engine's log buffer (`engine.logs.write`), so Logs shows the UI's lines with the Engine's | `createLogger` with `consoleLogSink` (from `logLevel` up) |
| `PreferencesStore` | Synchronous `read`/`write` of UI preferences (palette, colour mode, language) | `createLocalStoragePreferences`, under keys prefixed `ipaforge.` |
| `ColorSchemeSource` | The OS light/dark preference, and when it changes | `createMediaColorSchemeSource(matchMedia)` |
| `LocaleSource` | The OS's preferred languages, most preferred first | `createNavigatorLocaleSource(navigator)` |
| `EngineClient` (rpc) | The Engine: queries, runs and `classify`. `App` logs every request at debug level under `ui.engine` (the method, and the code of a failure; never the arguments) | the fake Engine over the memory transport (`createFakeEngineClient`); in Electron, `createEngineClient` over the MessagePort |
| `ClipboardWriter` | Writes text to the clipboard (copied diagnostics, copied log lines) | `createNavigatorClipboard(navigator)` |
| `FileSaver` | Saves text as a file (Save in Logs) | `createDownloadFileSaver`: a download, which Electron saves through the system dialog |
| `droppedFilePath` | Where a file dropped on the window is, to name it to the Engine (Preload) | the file's name, which only the fake Engine accepts; the Electron renderer passes the preload's `pathOf` |
| `LinkOpener` | Opens a web page in the browser (a pre-filled issue, an Apple page) | `createWindowLinkOpener(window)` |
| `appVersion` | The app's version, for diagnostics | the package version, defined by Vite as `import.meta.env.VITE_APP_VERSION` |

`createBrowserServices(window, { logLevel, engine, appVersion })` builds them all; `engine` is a function that gets the logger and returns the host's `EngineClient`. `App` touches no browser global when it is imported, so the Electron renderer can mount `<App services={…} language={…}/>` with its own services and history. Tests use `createMemoryPreferencesStore()`, a fixed or controllable colour-scheme source, `createFixedLocaleSource([...])`, `createMemoryClipboard()`, `createMemoryFileSaver()` and the fake Engine with no delay (`renderApp(path, { scenario })`).

## Engine queries

Components reach the Engine only through the TanStack Query hooks in `src/hooks/queries/`: `useDevices` (one entry per device), `useDeviceStatus`, `useAccounts`, `useTeams`, `useCatalogApps`, `useRecommendedChannel`, `useAppIdQuota`, `useCertificates` and `usePlanInstall`, plus the mutation `useSignOut` (`use-sign-out.ts`). Their cache keys live in one module, `query-keys.ts`, with every account query under `['accounts', …]` so one invalidation refreshes them all. A hook whose input is not known yet (no device picked) waits instead of asking. Failures arrive as `IPAForgeError`s with their code.

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
  2. If Apple asks for a second factor: with trusted devices, the code step straight away ("Enter the 6-digit code shown on your iPhone, iPad or Mac", and to keep it unlocked and tap Allow). **Didn't get a code?** has **Send a new code** and **Text** each of the account's numbers instead; the step then says a new code is on its way, or that Apple sent none. Without trusted devices, where to send the code comes first. A wrong code asks again and says so. Cancelling goes back to the form.
  The form has **Save my password in the system keychain**, ticked by default. When it is ticked, the password is passed to the Engine's `signIn` as `rememberPassword` and kept only in the encrypted secret store, so an expired session is renewed without asking.
  3. "Signed in as …", then **Done**. The Engine has saved the account, and the accounts query is invalidated (not polled).

  Each step stays on screen while Apple works on its answer: the form (read-only, **Sign in** busy, "Signing in…") until the password is checked, the method choice, when there is one (the chosen option busy, "Sending the code…") until the code is sent, the code step (**Verify** busy, the code locked, "Checking the code…", or "Sending a new code…") until Apple answers. The next step replaces it only when the Engine asks it or the run ends; the waiting text is announced through an `aria-live` region. In the browser dev host the fake Apple takes about 600 ms per answer, so these states show.

  A failure (wrong password, the anisette server down…) shows its code's translated title and body under the form. The question dialogs (`components/prompts/`) are shared with the install run.
- A **sidebar** (`nav`) on the start edge. **Install** and **Preload** come first; after a separator, a **Manage** group holds **Devices**, **Accounts**, **Certificates**, **Logs** and **Settings**. The current section has `aria-current="page"`, and the highlight is styled from that attribute.
- The current page in `main`. **Install** is the home page.

  The **Install** page (`features/install/`), before a run, shows:
  - the device and Apple ID notices (above);
  - **What to install**: SideStore, or LiveContainer + SideStore, each with the App IDs it uses;
  - the **Channel**, Stable or Nightly, with the one the catalog recommends for the device's iOS marked;
  - **This install**, from the Engine's read-only `planInstall`: the App IDs it uses and how many are left this week (and when the next frees), the free-app slots on the device, whether the certificate is reused, and the team. It is read once the device and the Apple ID are ready, and again when the choice changes; never polled;
  - **Install**, which waits only for the device (and an Apple ID that isn't blocked there, with enough App IDs). An expired session doesn't block it: the run asks for the password.

  Pressing Install starts `engine.installSideStore`. The run lives in a store kept by `App` (`state/active-run/`), not in the page, so it goes on in other sections, with a badge on **Install** in the sidebar. Its events are pushed by the Engine and reduced into a view (`utils/reduce-run-event.ts`, one handler per event type, and `run-view.ts`): every step with its state, its progress (a running transfer or iOS's install as a bar with the bytes, speed and time left, or iOS's percent and phase; an automatic retry) and, once done, what it did (the Engine's `step-detail`, worded by `run/utils/step-report-texts.ts`, one entry per kind: "SideStore 0.7.0 · Stable", "Saved session reused", "Reused the saved certificate", "2 new · 6 left this week"), the overall progress, the question waiting for an answer, and how it ended. The page shows it in one full-width column: the title and progress (with the time left), a strip with the app, channel, device, Apple ID, App IDs left and the free apps on the device (from the plan the home page read), how it is going or how it ended, then the steps. While a run installs over Wi-Fi, a notice says a cable is much faster for large apps.
  - **Questions** show as dialogs over any section (`features/install/prompts/run-prompt-host.tsx`, one dialog per question in `asked-prompts.ts`). Each has **Cancel install**, which stops the run at that step; **Resume** asks it again. After an answer the dialog stays, its controls read-only and the chosen one busy, until the Engine's next event (`answering` in the run view).
    - **Password** and **second factor**: as in sign-in.
    - **Team**: one click per team, saying what free and paid mean; the Engine remembers the choice for the Apple ID.
    - **Revoke a certificate**: picked in a list, then confirmed with a red **Revoke and continue**. Each certificate says who made it, from the machine name Apple keeps with it (IPAForge elsewhere, SideStore/AltStore, a named computer, unknown), and what revoking it breaks, in amber. One made by IPAForge is suggested and listed first.
    - **Remove an app to make room** (the free-app limit): picked, then confirmed with a red **Remove and continue**.
    - **Share the certificate** with an imported app that looks like SideStore: **Share** or **Don't share**.
    - **Which apps get the pairing file**: a checkbox row per app, all ticked to start, with what each known app does with the file (`pairingAppPurposeKeys`), **Select all** / **Clear all**, and a button that counts them ("Place in 2 apps").
    - A question a newer Engine asks that this version doesn't know offers **Cancel install**.
  - **Ended:** installed, with what to do on the device; cancelled, with **Resume** from the checkpoint (finished steps aren't repeated); failed, with the recovery box (`features/install/recovery/`):
    - the error's title and text (the code itself only in the diagnostics);
    - the fixes the Engine lists for the code (the diagnostics catalogue, via `engine.classify`), in its order: the first as a card with what to do (a sentence, steps, or an Apple page with **Copy**) and its button ("It's on, try again"), the others as buttons;
    - what each fix does is a table in `constants.ts` (`fixes`, one entry per `RecoveryAction`): continue from the checkpoint, ask the device to trust this computer and then continue (`engine.pairDevice`), **Use another Apple ID** (a picker of the saved Apple IDs, without the one that failed or any blocked on the device; the run starts again with the one picked, which becomes the one in use), **Install from Nightly/Stable** (names the other channel and starts again on it), or only explain (no App IDs left, with the date the next one frees from the plan; device support on Windows). Apple pages have **Open** (in the browser) and **Copy**. Fixes whose screen comes in a later phase (another anisette server, another IPA, updating IPAForge, choosing another team) aren't shown yet;
    - Try again isn't offered twice when the first fix already continues the run;
    - where the run continues from, **Copy diagnostics** (the code, step, app version, install choice and device model, never an Apple ID, name or serial), **Back to Install** (to choose another app, channel or Apple ID; the cancelled box has it too), **Show logs** (Logs with only this run's lines, from when it started to when it ended), and **Report the problem**, which opens a new GitHub issue in the browser with the title and diagnostics filled in (`utils/issue-url.ts`); nothing is sent until the user submits it there.

**Preload** (`features/preload/`) installs your own apps. It has two tabs, **Add apps** and **Sources**. Apps come from four places:

- **Drop .ipa files** anywhere on the window (the drop zone lights up). A file that isn't an .ipa is listed as such, never sent to the Engine.
- **Choose files…** opens the host's file dialog (`engine.chooseIpas()`; in the desktop app the main process opens it).
- **Add from a link…**: a direct https link to an .ipa, which the Engine downloads first.
- **Browse apps**: the apps of every source that's on, one card each, laid out the same way: the icon with the name and developer (and **Recommended**), what it's for in two lines, then a footer with the latest version and size and where it comes from (`· +N` when other sources list it too, all of them in its tooltip; amber for a source you added) beside **Add**. Nothing is cut off: long names and sources wrap.
  - **Sources:** the IPAForge catalog (SideStore, LiveContainer + SideStore, LiveContainer, StikDebug, Feather; releases from GitHub, checked against their published SHA-256) and the AltStore-format app sources.
  - **One card per app:** the same app in two sources shows once, from the first (built-in sources come first), and its tag says how many others have it ("IPAForge catalog +1"; hover for their names).
  - **Filter and search:** a source filter (All sources, or one) and a search on name, developer and subtitle. **Manage sources** opens the Sources tab.
  - **Details:** the whole card opens them. A catalog app's are read when they open (`catalogReleases`: each channel's latest release on GitHub, its `.ipa` link, size and date), shown the same way: its channels are the versions to pick, and **Add** adds it on the channel picked. A source app's (its name is the button, stretched over the card; **Add** and the source line stay on top): its description, developer, a version picker (the latest, or an older one), size, the iOS it needs, and its source. A source the user added says that IPAForge doesn't review its apps. **Install with SideStore** (not for SideStore itself, nor LiveContainer + SideStore) shows the code for `sidestore://install?url=<that version's .ipa>`: SideStore downloads, signs and installs it on the iPhone itself (on a free Apple ID it counts toward the 3 apps); **Back** returns to the details.
  - **Adding:** a source app is added by its version's download link (`{ kind: "url" }`) and its row says "From <source>"; a catalog app by its id.
  - **A source that can't be read:** Browse apps shows a warning with **Try again**, and keeps showing that source's apps from its last good copy.

**Sources** lists every app source:
- **Built in and trusted:** the IPAForge catalog and SideStore's official source. They can be turned off, but not removed.
- **Added by you:** any other source. Each can be turned on or off, refreshed (AltStore sources) or removed; removing asks first.
- **Status line:** each source shows how many apps it has, when it was last read, how many apps were left out (no https `.ipa` download), or that its last refresh failed.
- **Layout:** what the tab is for on one line, then **Add source…**, **Refresh all** and **Add all to SideStore**; each source's name, link and status first, its actions on a line of their own under them.
- **Add to SideStore** (on each source you added, in the AltStore format): a dialog with a QR code of `sidestore://source?url=<its link>` (SideStore's own link: its `URLHandler`), the three steps on the iPhone (Camera, the banner, Add) and the link with **Copy**. **Add all to SideStore** goes through every such source, one code after another (SideStore adds one source per link). The built-in sources have none: the IPAForge catalog isn't in SideStore's format, and SideStore has its own source. The code is drawn here (`components/qr-code.tsx`, from `uqr`): nothing leaves the computer. After a SideStore install, the Done screen offers the same for the sources you added.
- **Add source…:** paste a link, then **Check**. The Engine reads it without saving it (`checkSource`), and the dialog shows a preview: the source's name, how many apps, a few of them, what was left out, and a warning to add only sources you trust. **Add source** then saves it. A link that isn't https is refused in the dialog; one the Engine can't reach, that isn't a source, or that's already added gets its error's title. Each change refreshes the list and Browse apps (the `sources` query keys).

The list (`state/preload/`, kept while you visit other sections) asks the Engine's `planInstall` for each app once the device and the Apple ID are ready, and shows what it says:

- each app's name and version, how many App IDs it uses (with its extensions), whether it is new on the device or updates the version already there (keeping its data), and for SideStore that it gets the pairing file and certificate;
- or why it can't be installed: needs a newer iOS (both versions said), an encrypted App Store app, not an app, a release that is gone. Each row can be removed.

**This install** adds the ready apps up: new App IDs against what's left this week (and when the next frees), the free-app slots after the install (the run asks which app to remove when it would go over), the certificate and the team. **Install N apps** waits for:

1. the device and the Apple ID, as on Install;
2. every app read;
3. no app that can't be installed;
4. enough App IDs.

It starts `engine.installApps` with the ready apps. The run is the same run view as Install (one run at a time, in `state/active-run/`, which holds either kind; the other page says an install is running and links to it), with the steps grouped by app: the device and Apple ID steps first, then each app's own. **Done** empties the list.

The browser dev host's fake Engine plays it too: its file dialog picks `MyGame.ipa`, a link "downloads" for a moment, StikDebug is on the device in an older version, and names decide the problems (a name with `Encrypted`, `Future` or `NotAnApp` in it). Its sources: the catalog and SideStore's source built in, and any https link added as "Example Community Repo"; a link containing `unreachable` or `notsource` fails that way, and `skipped` leaves two apps out. The `source-offline` scenario makes SideStore's source fail to refresh.

**Manage → Accounts** (`features/accounts/`) lists the saved Apple IDs with their teams and state, marks the one **in use**, and offers **Use**, **Sign in again** (only for an expired session; it opens sign-in with the Apple ID filled in) and **Sign out**. Signing out asks first, in a dialog that says what IPAForge forgets (the Apple ID, its session, its saved password) and what it keeps (its signing certificates, so signing in again reuses them; installed apps keep working until they expire). Signing out the Apple ID in use hands its place to the next saved one. An **Add Apple ID** button opens sign-in.

Accounts are local data, but the Engine's account store has no change feed, so the UI invalidates the accounts query after a sign-in or a sign-out (never on a timer or on focus). Teams come from `listTeams` when the picker or the page shows an Apple ID: one query per account (the same key), so the top bar, the menu and the Accounts page always agree. An expired session is an answer, not a failure: `useTeams` turns `apple.session_expired` into `{ kind: 'sign-in-needed' }` data, which never goes stale and is not asked again when a menu opens, a component mounts or the window gets focus. It changes only when that account signs in or out (both invalidate the account's queries). Other failures are not retried on mount either.

The first Tab stop is a **Skip to content** link, which is visible only when focused. After it come the two top bar pickers, then the sidebar links in display order, then the page. Every control is reachable and usable from the keyboard: a picker opens with Enter, Space or the arrow keys and closes with Escape.

**Manage → Logs** (`features/logs/`) shows what the Engine and the UI logged, newest at the bottom: each line's time, level, area (Install, Device, Apple, Catalog, Signing, Engine, Interface, App, from its scope) and message, and, pressed, its details full width underneath with **Copy line**.

- **Nothing is loaded whole.** The Engine keeps the last 5,000 records in memory (`createLogBuffer`, already redacted by the logger). The page asks for the newest 200 that match (`engine.logs.page`), and the next 200 up when the list nears the top. The list is virtual (`@tanstack/react-virtual`): only the rows on screen and a few around them are rendered, and a row that opens its details is measured as it renders.
- **Filters and search run in the Engine**, next to the buffer: the level (All, Info, Warnings, Errors, each with its count), the area, the text (in the message, the scope and the fields, once typing pauses for 250 ms; matches are marked), and an install run's time span. Active filters show as chips, each removable. The filters live in a store kept by `App` (`state/log-view/`), so they stay when the user leaves Logs and comes back.
- **New lines are pushed** (`engine.logs.watch`), never polled. While the list is at the bottom it follows them; scrolled up, it stays put and counts them, with **N new lines · Jump to latest**. Older pages added above keep the view still.
- **Copy** puts the lines the filters show on the clipboard; **Save…** writes every line kept this session to `ipaforge-logs-<date>-<time>.log`. Both read the lines from the Engine first and say how many, and that the logs name the device, apps and team. **Clear** empties the view only.
- **Include debug details** has the Engine record debug lines too (`engine.logs.setLevel`), until the app restarts.
- **Ctrl+L** (⌘L on macOS) opens Logs from any section, and goes back from Logs (`features/logs/hooks/use-logs-shortcut.ts`, mounted by the shell); <kbd>/</kbd> focuses the search.

**Apps** (`features/apps/`) lists the apps on the device in use that are signed with one of the Apple ID's teams (`engine.installedApps`), read from the device: its provisioning profiles say which team signed each app and when it expires.
- **Installed by IPAForge,** soonest to expire first. Each row shows:
  - the name and version, with an **Update: x.y** chip when a source that's on lists a newer version (by the app's original bundle id);
  - when it expires (green; amber inside the refresh window; red once expired, "won't open") and where it came from (the catalog, the source listing its link, the link's host, or the file);
  - **Update**, **Refresh** and **Remove**. The buttons sit beside the text in a wide row and under it, lined up with the text, in a narrow one (a container query); long names and links wrap.
- **Refresh** asks the Engine first (`refreshPlan`) and then starts one run (`refreshApps`). An app whose certificate still holds gets a new profile only, like SideStore's refresh: nothing is installed again. The others are signed again and installed over the old app from its kept IPA (`{ kind: "installed", bundleId }`), its catalog app or its link, keeping its data and the certificate permission it had. In the run, each app says which: "New profile only", or "Installed again" and why (its certificate is no longer valid, or IPAForge can't tell which certificate signed it). If Apple doesn't answer the plan, every app that can be is installed again. An app installed by IPAForge on another computer is recognised by its mark and refreshed the same way, even one from an `.ipa`; it's left out only when it would need installing again and there's nothing to install it from. **Update** installs the newer version's link. Updates come only from IPAForge's own sources or the source the app came from: an update keeps the app's data, so a source added for other apps can't replace it. While a run goes on, each row shows its step and a bar, or "Waiting for its turn". **Refresh all** and **Update all** sit at the top; an expired app gets a red notice with **Refresh it now**.
- **Not kept by IPAForge yet:** apps signed with the same teams before this version of IPAForge or by another tool. Refresh installs one again from the IPAForge catalog or a source that lists it (keeping its data); with nothing listing it, adding its `.ipa` in Preload lets IPAForge refresh it. When several sources list it, the one that also lists the version on the device comes first (the app most likely came from it), then IPAForge's own; the row says so ("Found in X and 1 other source") with a picker of each source and the version it would install (`utils/adopt-source.ts`).
- **Refresh apps automatically** (on by default, 2 days before; 1, 2 or 3; `state/auto-refresh/`, saved with the UI preferences): while IPAForge is open, the device connected and no install running, the apps inside the window are refreshed in one run (`features/apps/hooks/use-auto-refresh.ts`, mounted by the shell). No polling: one timer wakes it when the next app enters the window, and each app is tried once per expiry date.
- The sidebar's **Apps** shows how many apps are due. The fake Engine has installed apps too (scenarios `apps-due`, `apps-expired`, `no-apps`).

**Repair SideStore** (`features/repair/`, at `/apps/sidestore`; the sidebar keeps **Apps** highlighted) checks what keeps SideStore on the device in use from refreshing apps by itself (`engine.checkSideStore`) and fixes it in one run.
- **Where it opens from:** **Check SideStore** on SideStore's row in Apps (in either list: installed by IPAForge, or by another tool), next to Refresh.
- **The checks come in one by one:** while IPAForge asks, every line waits with a spinner and "Checking…"; the answer comes in one piece, and its lines are shown one after another (`hooks/use-reveal.ts`, 150 ms apart; all at once with reduced motion). The plan shows once the last one is in.
- **The checks**, one line each with a tag: the device (unlocked, Developer Mode on); who signed SideStore (the team in use, another of the Apple ID's teams, or another Apple ID); its version against the catalog's latest; its expiry; the certificate that signed it; the certificate it holds to refresh with; and its pairing file. Each comes out OK, a warning, a problem, or **Can't tell** (grey): the signing certificate is only known from IPAForge's mark, so a SideStore another tool installed can't be told.
- **What IPAForge can't see** is listed for you to check on the iPhone: SideStore's VPN (LocalDevVPN) on while refreshing, and its anisette server.
- **The plan** (`utils/repair-plan.ts`):
  - needed: installing it again when its signing certificate was revoked or it holds none; a new profile when it expired or expires within 2 days; this computer's pairing file when it has none;
  - offered, as checkboxes: installing it again when the signing certificate can't be told, the certificate it holds may have been replaced (it can make its own after you sign in inside it), or it's out of date; replacing another computer's pairing file;
  - installing it again covers the rest (certificate, profile and pairing file come with it);
  - signed by another team or Apple ID, it's never installed again nor given a profile (a second SideStore would appear, without its data): a notice says to pick that Apple ID. The pairing file can still be placed.
- **Repair** starts one run (`engine.repairSideStore`), shown on the page like a SideStore install (a SideStore run with a `repair` part in the run store). When it ends, the checks are read again (their query key is under the installed apps').
- The fake Engine has scenarios `sidestore-broken`, `sidestore-unknown` and `sidestore-other-team` (and `no-apps` for none).

Routes are code-based (TanStack Router) in `src/router.tsx`: `/` redirects to `/install`, and there is one route per section in `src/sections.ts`, each with a page under `src/features/<section>/`, plus `/apps/sidestore` (Repair SideStore). A section's `group` decides where the sidebar shows it. Each navigation is logged at debug level under `ui.router`.

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

`t()` is typed against `en.json`, so a typo or a key missing from it is a type error. The keys for the Engine's data are required: every `ErrorCode` has `errors.<code>.title` and `errors.<code>.body`, every recovery action `recovery.<id>`, and every step label (`install.steps.*`, `pairing.steps.*`) its key. `src/i18n/required-keys.ts` turns a missing one into a type error that names it, and a test checks the same keys in every shipped language. A new `ErrorCode` therefore fails `pnpm typecheck` until it has English text. `ErrorCode` comes from `@ipaforge/kernel`; `RecoveryAction` and `StepLabel` come through `@ipaforge/rpc`.

### Adding a language

Nothing needs registering beyond the JSON file and `status.json`: the build picks up every `src/locales/*.json` as its own chunk.

1. Copy `en.json` to `<code>.json` (a BCP 47 code such as `fr` or `pt-BR`) and translate it.
2. Add `"<code>": "draft"` to `src/locales/status.json`.
3. If the language is written right to left and isn't Arabic, Hebrew, Persian or Urdu, add it to `RTL_LANGUAGES` in `src/i18n/languages/languages.ts`.

### Drafts and completion

`status.json` gives every language a status: `source` (English), `draft` or `reviewed`. Machine-drafted translations start as `draft`, and the language picker shows a small "draft" label next to them. A language loses the label once its whole file has been reviewed and set to `reviewed`. Today every language is `reviewed`, so the picker shows no labels.

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

Development builds (`pnpm --filter @ipaforge/ui dev`, `pnpm --filter @ipaforge/desktop dev`, and tests) also offer `en-XA` in the language picker. It is generated from `en.json` when it is first chosen: every letter accented, the text padded to about 40 % longer and wrapped in brackets, `[Îñšţåļļ~~~]`. ICU arguments, plural branches and `#` are left intact. Text without accents is hard-coded; text without its closing bracket is truncated. Production builds don't include it.

### Loading languages

English is part of the main bundle: it is the fallback and the source of the key types. Every other file in `src/locales/` (except `status.json`) is collected by `import.meta.glob` in `src/i18n/loading/locale-bundles.ts` and becomes its own chunk, about 20–30 kB each, fetched with a dynamic `import()` the first time the language is shown. The dev-only pseudo-locale and the ICU parser it needs load the same way.

- **Startup.** A host calls `await prepareLanguage(services)` before it renders. It resolves the language (the saved choice, else the best match for the OS languages), loads that bundle, and returns a `LanguageSetup`, which the host passes to `<App language={…}/>`. The first render is already in that language, so English never flashes. Both `src/main.tsx` and the Electron renderer do this.
- **Switching.** `choose` (behind the Language select) loads the bundle first, then changes the language and saves the choice. Until then the current language, and the select's value, stay as they are. If several choices are made quickly, only the last one applies.
- **Caching.** A bundle loads once per session; concurrent requests share one fetch.
- **Failures.** If a bundle can't load, a warning is logged under `ui.i18n` and nothing changes; choosing it again retries. At startup the app falls back to English (following the system) without overwriting the saved choice.
- **Timing.** Each load logs `language bundle loaded` at debug level under `ui.i18n` with its duration in `ms`.

Tests call `await renderApp(path, { languages, preferences, load })`, which runs `prepareLanguage` like a host; `load` replaces the bundle loader to delay or fail a language.

## Screenshot and accessibility tests

The `*.browser.test.tsx` files run the whole app in a real Chromium (Vitest's browser mode with Playwright, `vitest.browser.config.ts`), separately from the happy-dom tests:

```sh
pnpm test:browser                                # the checks; compares with the Linux reference images on Linux
pnpm --filter @ipaforge/ui test:browser:update   # rebuilds the reference images in Docker (any system)
```

- **Screenshots** (`src/screens.browser.test.tsx`): the Install page, a failed run with its recovery box, Preload with two apps, Logs and Settings, in English, German (long words), Arabic (right to left), Japanese and the pseudo-locale, plus every screen in dark mode. Each is compared with its reference image in `src/__screenshots__/`; a changed screen fails with the new image and a diff (CI uploads them as `screenshot-diffs`). The clock is fixed and animations are off, so images only change when the UI does.
- **No clipped text:** in every language, an element with translated text that overflows its box fails the test. The pseudo-locale wraps every message in brackets, so a clipped bracket is a label too short for a longer language. User data (names, Apple IDs) may truncate by design.
- **Accessibility:** axe checks every screen against WCAG 2.2 AA, in light and dark and right to left (contrast, names, roles, lists, target sizes).
- **Keyboard** (`src/keyboard.browser.test.tsx`): the skip link shows on the first Tab and moves focus to the page, Tab walks the top bar and the sidebar in order with a visible focus ring, a picker opens with Enter and closes with Escape back on its button, and Ctrl+L opens Logs.

**Reference images are Linux only.** Fonts and anti-aliasing differ on every system, so the images are made in Playwright's Docker image (`mcr.microsoft.com/playwright:v1.63.0-noble`), the one CI runs these tests in. On macOS or Windows `pnpm test:browser` writes and compares images for that system, which git ignores. After a deliberate UI change, run `test:browser:update`, look at the changed images, and commit them with the change.

## Styling rules

- **No CSS files.** The only stylesheet is `src/styles.css`, which imports Tailwind and then HeroUI. Everything else uses HeroUI components and Tailwind utilities.
- **No `style={{}}` for theming.** Colours come from the palette variables through utilities such as `bg-accent-soft`, `text-muted` and `border-border`.
- **Readable colours.** Text in red or amber uses `text-danger-soft-foreground` / `text-warning-soft-foreground` (the fills `bg-danger`, `bg-warning` are for shapes, not text); every palette keeps `muted` at 4.5:1 or more against its surfaces. The accessibility tests check both.
- **Logical utilities only:** `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `border-s`/`border-e`, never `ml-`/`left-`. The layout then mirrors in right-to-left languages without changes.
- **No string literals in JSX.** Text and user-visible props (`aria-label`, `aria-description`, `aria-placeholder`, `aria-roledescription`, `aria-valuetext`, `title`, `placeholder`, `label`, `alt`) come from `t()`. The Biome plugin `tooling/biome/no-jsx-literal-text.grit` fails lint on JSX text with a letter in it and on string literals in those props, in `src/**/*.tsx`.

## Related

- [Architecture](architecture.md): packages and dependency rules
- [Install Flows](install-flows.md): the Engine flows the UI drives

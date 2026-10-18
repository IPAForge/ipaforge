# Project Base Rules

> These are conventions to establish, not conventions detected: the codebase is new. Keep this file in sync with real practice.

## Naming Conventions

- Files: `kebab-case.ts` / `kebab-case.tsx`; tests sit next to the source as `*.test.ts`. React components follow the same rule (`top-bar.tsx` exports `TopBar`). The one exception is the UI's root component, `packages/ui/src/App.tsx` (with `App.test.tsx`), which keeps the name every React project uses.
- Variables and functions: `camelCase`; booleans read as predicates (`isLocked`, `hasPairRecord`)
- Event and action handlers start with `on`: props (`onClose`, `onSignedIn`) and the functions a component passes to them or attaches to events (`onAddAppleId`, `onChoose`). When a component's own handler would clash with a prop of the same name, name it after its event (`onFormSubmit` calling the `onSubmit` prop). Helpers that aren't handlers keep plain verbs (`follow`, `respond`).
- Types, classes, React components: `PascalCase`; no `I` prefix on object types
- Constants: `camelCase`, except frozen lookup tables, which use `PascalCase` objects with `as const` (e.g. `ErrorCode`)
- Packages: `@ipaforge/<context>` (`kernel`, `signer`, `device`, `apple`, `catalog`, `installer`, `rpc`, `ui`)
- Binary-format constants keep Apple's names (`CSMAGIC_CODEDIRECTORY`, `LC_CODE_SIGNATURE`) so they stay grep-able against the XNU headers

## Formatting and lint

Biome formats and lints everything (`biome.json`). ESLint (`eslint.config.js`) does three things Biome can't: blank lines between statements, SonarSource's rules (`eslint-plugin-sonarjs`, the rules SonarQube runs), and the `@ipaforge/structure` rules (see [File Structure](#file-structure)). `pnpm lint` runs both, and `pnpm lint:fix` fixes both. Editors format on save (see [contributing](../contributing.md#editor-setup)).

- **Style** for JS, TS and TSX: single quotes (double quotes in JSX attributes), no semicolons, no trailing commas, 80 columns, 2-space indent.

  ```ts
  export const label = (name: string) => {
    const trimmed = name.trim()

    return trimmed === '' ? 'Untitled' : trimmed
  }
  ```

- **Imports** are sorted by Biome into four groups, separated by a blank line and sorted alphabetically within each:
  1. Node built-ins (`node:fs`);
  2. external packages (`react`, `zod`);
  3. our own: `@ipaforge/*` and every `@<alias>/*` from `tsconfig.base.json` `paths` (`@kernel/…`, `@ui/…`);
  4. relative paths (rare, since imports are absolute).

  When you add an alias to `tsconfig.base.json` `paths`, add it to both lists of the `organizeImports` groups in `biome.json` (the exclusion from external packages and the "our own" group).
- **`type`, not `interface`** (`useConsistentTypeDefinitions`): `type Props = { … }`, and `type A = B & { … }` where an interface would extend. The one exception is module augmentation (`declare module '…' { interface … }`), which TypeScript only allows on interfaces; those keep a `biome-ignore` saying so (`router.tsx`, `i18n/setup/types.ts`).
- **Every component's props are a named type** called `<Component>Props` (`type FactProps = { … }`, `({ label, value }: FactProps)`), never written inline in the parameter (`({ label }: { label: string })`), even for one prop. A props type built on another is named too (`type FailedProps = OutcomeProps & { failure: RunFailure }`). It sits above the component, or in the folder's `types.ts` when the file would otherwise declare more than one type (see [File Structure](#file-structure)).
- **`readonly` where mutation would be a bug.** Engine packages (`kernel`, `signer`, `device`, `apple`, `catalog`, `installer`, `rpc`) mark fields `readonly` and use `readonly T[]` / `ReadonlyMap`, because records travel through many functions. React component props in `packages/ui` don't: React already treats props as read-only, so `readonly` there only adds noise. Non-prop UI types (options, theme tokens, shared state) keep it, and `readonly T[]` stays wherever a prop must accept read-only arrays.
- **Blank lines** (ESLint `@stylistic/padding-line-between-statements`): one after the import block, and one before a `return` that follows a `const` or `let` declaration.
- **Unused code:** unused imports are errors; unused variables are warnings, except names starting with `_`.
- **`console`** warns everywhere except the probe CLIs, `scripts/`, the log sinks and tests (an override in `biome.json`, not inline ignores).
- **SonarSource rules** (`sonarjs.configs.recommended`) run on every `.ts`/`.tsx` file, so CI catches what SonarQube would: regexes that backtrack (`super-linear-regex`), cognitive complexity above 15, nested ternaries and template literals, tests without assertions, hard-coded credentials and the like. Fix the code rather than silencing the rule: split complex functions into named helpers, scan strings by hand instead of using a backtracking regex on untrusted input, and make each test assert its outcome in its own body. A few rules are off, each with its reason in `eslint.config.js`:
  - `no-redundant-optional` (S4782): with `exactOptionalPropertyTypes`, `field?: T` and `field?: T | undefined` mean different things (also off for SonarQube for IDE in `.vscode/settings.json`);
  - `unused-import` and `no-unused-vars`: Biome's `noUnusedImports` and `noUnusedVariables` already cover them, and the latter allows the `_` prefix;
  - `no-os-command-from-path`, only in `scripts/`, `packages/*/scripts/`, `apps/desktop/scripts/`, `fixtures/` and tests: maintainer tools and tests run `codesign`, `openssl`, `security`, `plutil` and `ditto` from `PATH` on purpose. Production code must not.
- **Exceptions** to a SonarSource rule are for deliberate test fixtures only (a fake password, an `http://` URL whose refusal is under test, a private test IP). Disable the one line with the reason after `--`, so a reviewer can judge it:

  ```ts
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- the downgrade under test must be refused
  redirectTarget(from, 'http://gsa.apple.com/auth', headers)
  ```

## Functions

- Use arrow functions everywhere: `const name = (args): Return => …` and `export const name = …`. **Never** write a `function` declaration or expression. This is enforced by the Biome GritQL plugin `tooling/biome/no-function-declaration.grit` and by `useArrowFunction`.
- Prefer concise bodies for single expressions (`=> value`). Wrap object literals in parentheses: `=> ({ … })`.
- Object literals use arrow properties (`start: (controller) => { … }`), not method shorthand, unless `this` is required.
- Classes are still allowed where state and invariants belong together (`IPAForgeError`, `ByteReader`). Their methods use normal class syntax.
- Arrow `const`s are not hoisted: define helpers before any top-level code runs them.

## File Structure

Every file does one job, and the lint (`@ipaforge/structure` in `tooling/eslint/structure.js`) holds the parts a machine can check.

- **One component per file.** A `.tsx` file holds one component, its imports and, at most, its one type (usually its props). Nothing else lives at its top level: a smaller component gets its own file next to it, a lookup table goes to `constants.ts`, logic to a hook or a utils file (`component-file`).
- **At most one type per file.** A file that needs one type (a component's props, a function's options) declares it at the top. Two or more go into the folder's **`types.ts`**, one per folder, imported where they're used (`one-type-per-file`). Test files are exempt.
- **No `switch`.** Branch through a mapped object typed so a missing case fails typecheck (`no-switch`):

  ```ts
  const handlers = {
    started: onStarted,
    progress: onProgress,
    finished: onFinished
  } satisfies Record<RunEvent['type'], (view: RunView, event: never) => RunView>
  ```

- **Lookup tables are constants.** Maps from a state to classes, icons or translation keys live in the folder's `constants.ts`, not in the component.
- **Folders by job.** A UI feature folder (`features/install/run/`) holds `components/` (one per file), `hooks/` (`use-….ts`), `utils/` (pure functions), `constants.ts` and `types.ts`, each only when needed; its page component stays at the feature root. Engine packages keep `domain/`, `application/` and `infrastructure/`, with the same `types.ts` and `constants.ts` rule inside each module folder.

## Imports

- Use absolute imports everywhere: `@<package>/…` inside a package (for example `@signer/domain/blobs/index.ts`), and `@ipaforge/<package>` across packages. Relative `./` or `../` imports are not allowed, and neither is another package's `@alias`. Both are enforced by `pnpm check:boundaries` (`relative-import`, `foreign-subpath`).
- Aliases are declared once in `tsconfig.base.json` `paths`. Vite and Vitest read them through `tooling/vite/workspace-aliases.ts`; esbuild and tsx read the tsconfig directly. Package scripts run with `tsx`, because plain `node` doesn't resolve tsconfig paths.

## Module Structure

- One bounded context per package. Each package exposes its public API only from `src/index.ts`, and deep imports across packages are forbidden.
- `domain/` holds types, value objects and ports. `application/` holds use cases. `infrastructure/` holds library-backed implementations that are still platform-free.
- Platform adapters (`node:*`, `electron`) live only in `apps/desktop`.
- No magic values. Format constants (magics, slots, OIDs, bundle paths, file modes) live in named constants modules (`*constants.ts`, `oids.ts`, `layout.ts`). Tunables (limits, page size, hash algorithms, reservations, archive settings) live in `domain/config.ts` with exported defaults, and callers can override them.
- ESM only, TypeScript `strict` plus `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and `erasableSyntaxOnly`. That means no enums, namespaces or constructor parameter properties, so every file runs under Node's built-in type stripping (scripts run with plain `node`).

## Error Handling

- Throw `IPAForgeError` with an `ErrorCode`. Never throw strings, and never throw a bare `Error` across a package boundary.
- Wrap foreign errors with `{ cause }`. Never lose the original.
- Validate all external input (Apple responses, device plists, GitHub API, RPC payloads) with zod at the boundary. Inside the core, trust the types.
- Async operations that can take more than about 1 s accept an `AbortSignal`.

## Control Flow

- Prefer flat, readable control flow over deeply nested conditionals. Use guard clauses, early `return`/`continue`, small named helpers, or explicit classification logic when they make the code easier to follow. Handle edge cases and irrelevant branches early so the main path stays visible.
- Pure functions for binary formats (input bytes → output bytes). Side effects only in application services and adapters.

## Binary Data

- Use `Uint8Array` everywhere, never Node `Buffer` in `packages/`.
- Be explicit about endianness at every `DataView` call (`getUint32(o, true)` for Mach-O, default big-endian for code-signature blobs). Add a comment wherever it isn't obvious.

## UI

- Build UI from HeroUI components and Tailwind utilities only. No `.css` files beyond the single entry import, and no `style={{}}` for theming.
- Every user-visible string goes through i18next (`t("…")`), so string literals don't appear in JSX. The Biome GritQL plugin `tooling/biome/no-jsx-literal-text.grit` enforces this for `packages/ui/src/**/*.tsx`: it rejects JSX text containing a letter and string or template literals in `aria-label`, `aria-description`, `aria-placeholder`, `aria-roledescription`, `aria-valuetext`, `title`, `placeholder`, `label` and `alt`. Props nobody sees or hears (`className`, `key`, `id`, `data-testid`, `href`, …) may hold literals.
- Strings live in `packages/ui/src/locales/<language>.json`, nested by feature (`nav.install`, `settings.language.title`), in ICU MessageFormat (`{count, plural, one {…} other {…}}`). `en.json` is the source of truth; `status.json` lists every language as `source`, `draft` or `reviewed`.
- Keys are typed: `t()` accepts only keys of `en.json` (react-i18next `CustomTypeOptions`, `i18n/setup/types.ts`). Every `ErrorCode` needs `errors.<code>.title` and `.body`, every recovery action `recovery.<id>`, and every step label its key; a missing one fails typecheck (`i18n/required-keys.ts`), and a test checks the same keys in every shipped language. `pnpm check:locales` fails on missing or extra keys, broken ICU or changed placeholders in any language.
- Only `en.json` is bundled; other languages load on demand (`import.meta.glob`). Hosts `await prepareLanguage(services)` before rendering `<App language={…}/>`, and language changes go through `useLanguage().choose`, which loads before switching.
- Format dates, numbers, lists and relative times with `useFormat()` (standard `Intl`, memoised per locale), never by hand. Error text comes from the code's keys, never from `IPAForgeError.message`.
- Direction-dependent icons (a "next" chevron, a "back" arrow) use `MirroredIcon`, which flips them in right-to-left languages.
- Components never call adapters or the engine directly. They use `EngineClient` hooks (TanStack Query) from `ui/hooks`.
- **Live data: push, not polling.** Live state comes from push events: usbmuxd `Listen` for devices, run streams for installs, the log stream. Local data such as accounts is refreshed after sign-in, sign-out and each install run (a store-change stream may come later). Poll only as a fallback where no event source exists, slowly, and only while the UI is waiting for something (such as "unlock the device" during a step), then stop. Apple and network data (teams, certificates, App ID quota, catalog) is fetched on demand and cached: when a screen needs it or right before an install, plus an explicit Refresh. No `refetchInterval`, and no `refetchOnWindowFocus` / `refetchOnReconnect` for queries that hit Apple or GitHub; the shared query client (`hooks/queries/query-client.ts`) sets those defaults.
- The host reaches the UI only through `UiServices` (`ui/services`), passed to `<App services={…}/>`: the kernel `Logger`, `PreferencesStore` (synchronous `read`/`write` of UI preferences such as palette, colour mode and language), `ColorSchemeSource` (the OS light/dark preference) and `LocaleSource` (the OS's preferred languages). `ui/services` also holds their implementations: browser ones (`createBrowserServices`, used by `src/main.tsx`) and in-memory ones for tests. The Electron renderer passes its own. `App` touches no browser global at import time.
- `packages/ui/src` layout: `App.tsx` (providers + router), `main.tsx` (browser entry), `index.ts` (public API), `types.ts`, `router.tsx`, `sections.ts`, `styles.css`, then `components/`, `features/<section>/`, `hooks/`, `state/` (stores outside components: `active-run/`, `selection/`), `services/`, `theme/`, `i18n/` and `locales/` (JSON per language). A feature folder splits into `components/`, `hooks/`, `utils/`, `constants.ts` and `types.ts` as needed. Group a folder's files into subfolders by job once it holds more than a handful (e.g. `i18n/setup|languages|loading|provider`, `theme/palettes|store|provider`, `services/preferences|system|logging`); keep tests next to the file they test.
- `biome.json` enables Biome's React domain (all rules) and the `a11y` group as errors for `packages/ui/**`.
- Use logical Tailwind utilities only (`ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `border-s`/`border-e`), so layouts mirror in right-to-left languages.

## Logging

- Use the `Logger` port only (`logger.debug|info|warn|error(msg, fields)`), with structured fields. Never call `console` directly (Biome's `noConsole` warns). The exceptions are the log sinks that write to a console (`packages/ui/src/services/logging/console-log-sink.ts`, `apps/desktop/src/main/logger.ts`, the kernel logger's last-resort fallback), the probe CLIs and scripts, and tests that print benchmarks.
- Redact passwords, tokens, anisette headers, private keys and device serials by default. Log level comes from `LOG_LEVEL`, and the log viewer can switch to debug until the app restarts (`createLogLevel`, read on every record).
- The desktop main process keeps the last records in memory (`createLogBuffer`) for the log viewer; the UI's records join them over rpc. Never log from code that handles the log feed itself.

## Testing

- Vitest unit tests for every `domain/` and `application/` module.
- The signer and encoders use golden fixtures (`fixtures/`) compared byte for byte with Apple `codesign` output.
- Adapters get contract tests that share one suite per port.


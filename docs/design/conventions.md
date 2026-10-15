# Project Base Rules

> These are conventions to establish, not conventions detected: the codebase is new. Keep this file in sync with real practice.

## Naming Conventions

- Files: `kebab-case.ts` / `kebab-case.tsx`; tests sit next to the source as `*.test.ts`. React components follow the same rule (`top-bar.tsx` exports `TopBar`). The one exception is the UI's root component, `packages/ui/src/App.tsx` (with `App.test.tsx`), which keeps the name every React project uses.
- Variables and functions: `camelCase`; booleans read as predicates (`isLocked`, `hasPairRecord`)
- Types, interfaces, classes, React components: `PascalCase`; no `I` prefix on interfaces
- Constants: `camelCase`, except frozen lookup tables, which use `PascalCase` objects with `as const` (e.g. `ErrorCode`)
- Packages: `@loadstar/<context>` (`kernel`, `signer`, `device`, `apple`, `catalog`, `installer`, `rpc`, `ui`)
- Binary-format constants keep Apple's names (`CSMAGIC_CODEDIRECTORY`, `LC_CODE_SIGNATURE`) so they stay grep-able against the XNU headers

## Functions

- Use arrow functions everywhere: `const name = (args): Return => …` and `export const name = …`. **Never** write a `function` declaration or expression. This is enforced by the Biome GritQL plugin `tooling/biome/no-function-declaration.grit` and by `useArrowFunction`.
- Prefer concise bodies for single expressions (`=> value`). Wrap object literals in parentheses: `=> ({ … })`.
- Object literals use arrow properties (`start: (controller) => { … }`), not method shorthand, unless `this` is required.
- Classes are still allowed where state and invariants belong together (`LoadstarError`, `ByteReader`). Their methods use normal class syntax.
- Arrow `const`s are not hoisted: define helpers before any top-level code runs them.

## Imports

- Use absolute imports everywhere: `@<package>/…` inside a package (for example `@signer/domain/plist/index.ts`), and `@loadstar/<package>` across packages. Relative `./` or `../` imports are not allowed, and neither is another package's `@alias`. Both are enforced by `pnpm check:boundaries` (`relative-import`, `foreign-subpath`).
- Aliases are declared once in `tsconfig.base.json` `paths`. Vite and Vitest read them through `tooling/vite/workspace-aliases.ts`; esbuild and tsx read the tsconfig directly. Package scripts run with `tsx`, because plain `node` doesn't resolve tsconfig paths.

## Module Structure

- One bounded context per package. Each package exposes its public API only from `src/index.ts`, and deep imports across packages are forbidden.
- `domain/` holds types, value objects and ports. `application/` holds use cases. `infrastructure/` holds library-backed implementations that are still platform-free.
- Platform adapters (`node:*`, `electron`) live only in `apps/desktop`.
- No magic values. Format constants (magics, slots, OIDs, bundle paths, file modes) live in named constants modules (`*constants.ts`, `oids.ts`, `layout.ts`). Tunables (limits, page size, hash algorithms, reservations, archive settings) live in `domain/config.ts` with exported defaults, and callers can override them.
- ESM only, TypeScript `strict` plus `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and `erasableSyntaxOnly`. That means no enums, namespaces or constructor parameter properties, so every file runs under Node's built-in type stripping (scripts run with plain `node`).

## Error Handling

- Throw `LoadstarError` with an `ErrorCode`. Never throw strings, and never throw a bare `Error` across a package boundary.
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
- Every user-visible string goes through i18next (`t("…")`), so string literals don't appear in JSX. The Biome GritQL plugin `tooling/biome/no-jsx-literal-text.grit` enforces this for `packages/ui/src/**/*.tsx`: it rejects JSX text containing a letter and string or template literals in `aria-label`, `aria-description`, `title`, `placeholder`, `label` and `alt`. Props nobody sees or hears (`className`, `key`, `id`, `data-testid`, `href`, …) may hold literals.
- Strings live in `packages/ui/src/locales/<language>.json`, nested by feature (`nav.install`, `settings.language.title`), in ICU MessageFormat (`{count, plural, one {…} other {…}}`). `en.json` is the source of truth; `status.json` lists every language as `source`, `draft` or `reviewed`.
- Keys are typed: `t()` accepts only keys of `en.json` (react-i18next `CustomTypeOptions`, `utils/i18n/i18next-types.ts`). Every `ErrorCode` needs `errors.<code>.title` and `.body`, every recovery action `recovery.<id>`, and every step label its key; a missing one fails typecheck (`utils/i18n/required-keys.ts`), and a test checks the same keys in every shipped language. `pnpm check:locales` fails on missing or extra keys, broken ICU or changed placeholders in any language.
- Only `en.json` is bundled; other languages load on demand (`import.meta.glob`). Hosts `await prepareLanguage(services)` before rendering `<App language={…}/>`, and language changes go through `useLanguage().choose`, which loads before switching.
- Format dates, numbers, lists and relative times with `useFormat()` (standard `Intl`, memoised per locale), never by hand. Error text comes from the code's keys, never from `LoadstarError.message`.
- Direction-dependent icons (a "next" chevron, a "back" arrow) use `MirroredIcon`, which flips them in right-to-left languages.
- Components never call adapters or the engine directly. They use `EngineClient` hooks (TanStack Query) from `ui/hooks`.
- The host reaches the UI only through `UiServices` (`ui/services`), passed to `<App services={…}/>`: the kernel `Logger`, `PreferencesStore` (synchronous `read`/`write` of UI preferences such as palette, colour mode and language), `ColorSchemeSource` (the OS light/dark preference) and `LocaleSource` (the OS's preferred languages). `ui/services` also holds their implementations: browser ones (`createBrowserServices`, used by `src/main.tsx`) and in-memory ones for tests. The Electron renderer passes its own. `App` touches no browser global at import time.
- `packages/ui/src` layout: `App.tsx` (providers + router), `main.tsx` (browser entry), `router.tsx`, `sections.ts`, `styles.css`, then `components/`, `features/<section>/`, `hooks/`, `services/`, `theme/`, `locales/` (JSON per language) and `utils/` (`utils/i18n/`: the i18next setup and language logic).
- Use logical Tailwind utilities only (`ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `border-s`/`border-e`), so layouts mirror in right-to-left languages.

## Logging

- Use the `Logger` port only (`logger.debug|info|warn|error(msg, fields)`), with structured fields. Never call `console` directly; the one exception is the UI's browser log sink (`packages/ui/src/services/console-log-sink.ts`).
- Redact passwords, tokens, anisette headers, private keys and device serials by default. Log level comes from `LOG_LEVEL` or the settings screen.

## Testing

- Vitest unit tests for every `domain/` and `application/` module.
- The signer and encoders use golden fixtures (`fixtures/`) compared byte for byte with Apple `codesign` output.
- Adapters get contract tests that share one suite per port.


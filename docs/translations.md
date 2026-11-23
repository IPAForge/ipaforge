[← Contributing](contributing.md) · [Back to README](../README.md) · [User Interface →](ui.md)

# Translations

IPAForge is translated by pull request. The translations live in this repository and in the website's, as plain JSON files and one Markdown guide, so a translation is a change like any other.

**To help translate,** copy a language's file, translate the values, and open a pull request. Keep the keys, the `{placeholders}` and the ICU syntax as they are in English.

## What is translated

| What | Files | Repository |
|---|---|---|
| **App** | `packages/ui/src/locales/<lang>.json` (source `en.json`) | IPAForge/ipaforge |
| **Website** | `src/i18n/<lang>.json` (source `en.json`) | IPAForge/ipaforge.github.io |
| **Install guide** | `docs/i18n/<lang>/installing.md` (source `docs/installing.md`) | IPAForge/ipaforge |

The release notes stay in English: ipaforge.com shows them in English on every language's Release notes page, with a note saying so. The website's Troubleshooting page is made from the app's error texts, so it needs nothing of its own.

## How a translation reaches users

1. A translator opens a pull request with the language's file.
2. CI checks it like any other change: `pnpm check:locales` fails on a key `en.json` doesn't have, broken ICU syntax or placeholders that differ from English. A string that isn't translated yet is fine: it shows in English.
3. A maintainer merges it. The website rebuilds by itself when a locale file or the install guide changes on `main` (`.github/workflows/website.yml`).

**A language ships when `status.json` lists it.** A language's file can sit in the repository half done: the app offers only the languages in `packages/ui/src/locales/status.json`, and `check:locales` lists the others as "not shipped". Add a language there once it is mostly translated (about 90 %), as `"draft"`; the language picker labels drafts. Set it to `"reviewed"` once a native speaker has read the whole of it. The website offers every language that has its `src/i18n/<lang>.json`.

Links in the install guide are relative to `docs/`; ipaforge.com resolves them from the translated file's place, and the headings keep their English anchors there (by their order), so a link to `#opening-ipaforge-the-first-time` works in every language.

## See Also

- [Contributing](contributing.md): pull requests and conventions
- [User Interface](ui.md#translations): how the app loads languages, right to left, and the pseudo-locale

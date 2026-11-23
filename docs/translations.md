[← Contributing](contributing.md) · [Back to README](../README.md) · [User Interface →](ui.md)

# Translations

IPAForge is translated on **[Hosted Weblate](https://hosted.weblate.org)**, on its free plan for open-source projects. The translations themselves live in this repository and in the website's: Weblate is where people make them, and it sends them here as pull requests. If Weblate went away, nothing translated would be lost.

**To help translate,** go to [ipaforge.com/translate](https://ipaforge.com/translate/), sign in to Weblate and pick your language. You don't need git, JSON or a GitHub account.

## What is translated

| Weblate component | Files | Repository |
|---|---|---|
| **App** | `packages/ui/src/locales/<lang>.json` (source `en.json`) | IPAForge/ipaforge |
| **Website** | `src/i18n/<lang>.json` (source `en.json`) | IPAForge/ipaforge.github.io |
| **Install guide** | `docs/i18n/<lang>/installing.md` (source `docs/installing.md`) | IPAForge/ipaforge |

The release notes stay in English: ipaforge.com shows them in English on every language's Release notes page, with a note saying so. The website's Troubleshooting page is made from the **App** component's error texts, so it needs nothing of its own.

## How a translation reaches users

1. A translator saves strings on Weblate. Weblate collects the changes and opens (or updates) one pull request per component, from its own bot.
2. CI checks it like any other change: `pnpm check:locales` fails on a key `en.json` doesn't have, broken ICU syntax or placeholders that differ from English. A string that isn't translated yet is fine: it shows in English.
3. A maintainer merges it. The website rebuilds by itself when a locale file or the install guide changes on `main` (`.github/workflows/website.yml`).

**A language ships when `status.json` lists it.** Weblate can start a language at any time, and its file can sit in the repository half done: the app offers only the languages in `packages/ui/src/locales/status.json`, and `check:locales` lists the others as "not shipped". Add a language there once it is mostly translated (about 90 %), as `"draft"`; the language picker labels drafts. Set it to `"reviewed"` once a native speaker has read the whole of it. The website offers every language that has its `src/i18n/<lang>.json`.

## Setting up the Weblate project

For a maintainer, once: what the project and its three components need. Everything not listed keeps Weblate's default.

**Project:** name `IPAForge`, URL slug `ipaforge`, website `https://ipaforge.com`, translation instructions `https://github.com/IPAForge/ipaforge/blob/main/docs/translations.md`.

**App** (component slug `app`):

| Setting | Value |
|---|---|
| Version control system | GitHub pull request |
| Source code repository | `https://github.com/IPAForge/ipaforge.git` |
| Repository branch | `main` |
| File format | JSON nested structure file |
| File mask | `packages/ui/src/locales/*.json` |
| Monolingual base language file | `packages/ui/src/locales/en.json` |
| Edit base file | off |
| Language filter | `^(?!status$).+$` (so `status.json` isn't taken for a language) |
| Language code style | BCP style using hyphen as a separator (`pt-BR`, `zh-Hans`) |
| Translation flags | `icu-message-format` |
| File format parameters | JSON indentation 2, no key sorting, no ASCII escaping |

**Website** (component slug `website`):

| Setting | Value |
|---|---|
| Version control system | GitHub pull request |
| Source code repository | `https://github.com/IPAForge/ipaforge.github.io.git` |
| Repository branch | `main` |
| File format | JSON nested structure file |
| File mask | `src/i18n/*.json` |
| Monolingual base language file | `src/i18n/en.json` |
| Language code style | BCP style using hyphen as a separator |
| Translation flags | `safe-html, placeholders:r"\{\w+\}"` |
| File format parameters | JSON indentation 2, no key sorting, no ASCII escaping |

**Install guide** (component slug `install-guide`):

| Setting | Value |
|---|---|
| Source code repository | `weblate://ipaforge/app` (shares the App component's checkout) |
| File format | Markdown file |
| File mask | `docs/i18n/*/installing.md` |
| Monolingual base language file | `docs/installing.md` |
| Template for new translations | `docs/installing.md` |
| Language code style | BCP style using hyphen as a separator |
| Translation flags | `safe-html` |

Links in the guide are relative to `docs/`; ipaforge.com resolves them from the translated file's place, and the headings keep their English anchors there (by their order), so a link to `#opening-ipaforge-the-first-time` works in every language.

**GitHub:** in both repositories, Settings › Webhooks › Add webhook, payload URL `https://hosted.weblate.org/hooks/github/`, content type `application/json`, just the push event. Weblate then pulls each change to `main` straight away instead of hourly.

## See Also

- [Contributing](contributing.md): pull requests and conventions
- [User Interface](ui.md#translations): how the app loads languages, right to left, and the pseudo-locale

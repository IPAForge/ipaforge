// Types `t("…")` against the English messages (an unknown key is a type error), and the language setup a host
// prepares before the first render.

import type { i18n, ParseKeys } from 'i18next'

import type { LanguageChoice, LanguageStore } from '@ui/i18n/languages/types.ts'
import type { LoadBundle } from '@ui/i18n/loading/types.ts'
import type en from '@ui/locales/en.json'

/** The shape every locale file has: `en.json`, the source of truth. */
export type Messages = typeof en

declare module 'i18next' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: module augmentation merges into an interface, so it must stay one
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: Messages }
    returnEmptyString: false
  }
}

/** Every key `t()` accepts, e.g. `"nav.install"` or `"errors.device.locked.title"`. */
export type TranslationKey = ParseKeys

/** The UI's language state and i18next instance, ready before the first render. `App` takes it as a prop. */
export type LanguageSetup = {
  readonly store: LanguageStore
  readonly i18n: i18n
  /**
   * Loads `choice`'s language, then shows and saves it. The current language stays until the new one is
   * ready; if it can't load, nothing changes (a warning is logged).
   */
  readonly choose: (choice: LanguageChoice) => Promise<void>
}

export type PrepareLanguageOptions = {
  /** Defaults to the bundled loaders (dynamic imports); tests inject their own. */
  readonly load?: LoadBundle
  /** Logs missing keys; on in dev builds. */
  readonly warnOnMissingKeys?: boolean
}

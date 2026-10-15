import type { Logger } from "@loadstar/kernel";
import type { LocaleSource } from "@ui/services/locale-source.ts";
import type { PreferencesStore } from "@ui/services/preferences-store.ts";
import {
  isAvailableLanguage,
  type LanguageId,
  type ShippedLanguage,
  SOURCE_LANGUAGE,
  shippedLanguages,
} from "@ui/utils/i18n/languages.ts";
import { matchLocale } from "@ui/utils/i18n/match-locale.ts";

/** `PreferencesStore` key of the chosen language. */
export const LANGUAGE_PREFERENCE_KEY = "language";
export const SYSTEM_LANGUAGE = "system";

/** What the user picked in Settings: follow the system, or one language. */
export type LanguageChoice = typeof SYSTEM_LANGUAGE | LanguageId;

export interface LanguageState {
  readonly choice: LanguageChoice;
  /** The shipped language that best matches the OS languages. */
  readonly systemLanguage: ShippedLanguage;
  /** The language shown: the choice, or `systemLanguage` when following the system. */
  readonly locale: LanguageId;
}

export interface LanguageStore {
  getState: () => LanguageState;
  subscribe: (listener: () => void) => () => void;
  /** The language `choice` would show. */
  localeFor: (choice: LanguageChoice) => LanguageId;
  /** Persists `choice` and shows it; call once its messages are loaded. */
  setChoice: (choice: LanguageChoice) => void;
  /** Shows English, following the system, without touching the saved choice: for when no other bundle loads. */
  fallBackToSource: () => void;
}

export interface LanguageStoreOptions {
  readonly preferences: PreferencesStore;
  readonly localeSource: LocaleSource;
  readonly logger: Logger;
}

const readChoice = (preferences: PreferencesStore): LanguageChoice => {
  const saved = preferences.read(LANGUAGE_PREFERENCE_KEY);
  return isAvailableLanguage(saved) ? saved : SYSTEM_LANGUAGE;
};

const resolveLocale = (choice: LanguageChoice, systemLanguage: ShippedLanguage): LanguageId =>
  choice === SYSTEM_LANGUAGE ? systemLanguage : choice;

/** The UI language: the saved choice (an override) wins over the best match for the OS languages. */
export const createLanguageStore = ({ preferences, localeSource, logger }: LanguageStoreOptions): LanguageStore => {
  const listeners = new Set<() => void>();
  const preferred = localeSource.preferredLanguages();
  const systemLanguage = matchLocale(preferred, shippedLanguages, SOURCE_LANGUAGE);
  const choice = readChoice(preferences);
  let state: LanguageState = { choice, systemLanguage, locale: resolveLocale(choice, systemLanguage) };
  logger.debug("language resolved", { preferred: preferred.join(","), systemLanguage, locale: state.locale });

  const update = (next: LanguageState): void => {
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    localeFor: (next) => resolveLocale(next, state.systemLanguage),
    setChoice: (next) => {
      if (next === state.choice) return;
      preferences.write(LANGUAGE_PREFERENCE_KEY, next);
      update({ ...state, choice: next, locale: resolveLocale(next, state.systemLanguage) });
    },
    fallBackToSource: () =>
      update({ choice: SYSTEM_LANGUAGE, systemLanguage: SOURCE_LANGUAGE, locale: SOURCE_LANGUAGE }),
  };
};

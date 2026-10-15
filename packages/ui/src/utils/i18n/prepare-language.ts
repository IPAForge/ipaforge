import { scopeServices } from "@ui/services/scope-services.ts";
import type { UiServices } from "@ui/services/ui-services.ts";
import { createI18n } from "@ui/utils/i18n/create-i18n.ts";
import { createLanguageStore, type LanguageChoice, type LanguageStore } from "@ui/utils/i18n/language-store.ts";
import { type LoadBundle, loadLocaleBundle } from "@ui/utils/i18n/locale-bundles.ts";
import { createLocaleLoader } from "@ui/utils/i18n/locale-loader.ts";
import type { i18n } from "i18next";

const I18N_LOG_SCOPE = "i18n";

/** The UI's language state and i18next instance, ready before the first render. `App` takes it as a prop. */
export interface LanguageSetup {
  readonly store: LanguageStore;
  readonly i18n: i18n;
  /**
   * Loads `choice`'s language, then shows and saves it. The current language stays until the new one is
   * ready; if it can't load, nothing changes (a warning is logged).
   */
  readonly choose: (choice: LanguageChoice) => Promise<void>;
}

export interface PrepareLanguageOptions {
  /** Defaults to the bundled loaders (dynamic imports); tests inject their own. */
  readonly load?: LoadBundle;
  /** Logs missing keys; on in dev builds. */
  readonly warnOnMissingKeys?: boolean;
}

/**
 * Resolves the language (saved choice, else the best match for the OS languages) and loads its messages,
 * so the host can mount `App` without an English flash. Falls back to English if that bundle won't load.
 */
export const prepareLanguage = async (
  services: UiServices,
  { load = loadLocaleBundle, warnOnMissingKeys = import.meta.env.DEV }: PrepareLanguageOptions = {},
): Promise<LanguageSetup> => {
  const { preferences, localeSource, logger: uiLogger } = scopeServices(services);
  const logger = uiLogger.child({ scope: I18N_LOG_SCOPE });
  const store = createLanguageStore({ preferences, localeSource, logger });
  const i18n = createI18n({ logger, warnOnMissingKeys });
  const loader = createLocaleLoader({ i18n, load, logger });

  const { locale } = store.getState();
  if (await loader.ensure(locale)) await i18n.changeLanguage(locale);
  else store.fallBackToSource();

  let latestRequest = 0;
  const choose = async (choice: LanguageChoice): Promise<void> => {
    const request = ++latestRequest;
    const next = store.localeFor(choice);
    const loaded = await loader.ensure(next);
    if (!loaded || request !== latestRequest) return; // failed, or a later choice superseded this one
    await i18n.changeLanguage(next);
    store.setChoice(choice);
  };

  return { store, i18n, choose };
};

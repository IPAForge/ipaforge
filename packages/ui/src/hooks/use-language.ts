import { LanguageContext } from "@ui/utils/i18n/language-context.ts";
import type { LanguageState } from "@ui/utils/i18n/language-store.ts";
import type { LanguageSetup } from "@ui/utils/i18n/prepare-language.ts";
import { useContext, useSyncExternalStore } from "react";

const useLanguageSetup = (): LanguageSetup => {
  const setup = useContext(LanguageContext);
  if (!setup) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return setup;
};

/** The language choice, the detected system language and the language shown, plus `choose`, which loads and saves. */
export const useLanguage = (): LanguageState & Pick<LanguageSetup, "choose"> => {
  const { store, choose } = useLanguageSetup();
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return { ...state, choose };
};

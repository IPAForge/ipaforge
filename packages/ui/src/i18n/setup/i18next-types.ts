// Types `t("…")` against the English messages: an unknown key is a type error.
import type en from "@ui/locales/en.json";
import type { ParseKeys } from "i18next";

/** The shape every locale file has: `en.json`, the source of truth. */
export type Messages = typeof en;

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: Messages };
    returnEmptyString: false;
  }
}

/** Every key `t()` accepts, e.g. `"nav.install"` or `"errors.device.locked.title"`. */
export type TranslationKey = ParseKeys;

import type { LanguageSetup } from "@ui/utils/i18n/prepare-language.ts";
import { createContext } from "react";

/** The app's language setup, provided by `LanguageProvider` and read through `useLanguage`. */
export const LanguageContext = createContext<LanguageSetup | undefined>(undefined);

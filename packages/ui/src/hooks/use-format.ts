import { useLanguage } from "@ui/hooks/use-language.ts";
import { type Formatters, formattersFor } from "@ui/utils/i18n/formatters.ts";

/** Dates, numbers, lists and relative times formatted for the language shown. */
export const useFormat = (): Formatters => formattersFor(useLanguage().locale);

import { createLogger } from "@loadstar/kernel";
import { createI18n } from "@ui/utils/i18n/create-i18n.ts";
import type { LanguageId } from "@ui/utils/i18n/languages.ts";
import { loadLocaleBundle } from "@ui/utils/i18n/locale-bundles.ts";
import { createLocaleLoader } from "@ui/utils/i18n/locale-loader.ts";

const silentLogger = createLogger({ level: "error", sink: () => {} });
const options = { logger: silentLogger, warnOnMissingKeys: false };

/** A standalone i18next instance, the same as the app's, with `locale`'s real bundle loaded and shown. */
export const createTestI18n = async (locale: LanguageId = "en") => {
  const i18n = createI18n(options);
  await createLocaleLoader({ i18n, load: loadLocaleBundle, logger: silentLogger }).ensure(locale);
  await i18n.changeLanguage(locale);
  return i18n;
};

/** English `t`, for the text tests expect on screen. */
export const { t } = createI18n(options);

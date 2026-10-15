import { Chip } from "@heroui/react";
import { directionOf, isDraftLanguage, type LanguageId, nativeName } from "@ui/utils/i18n/languages.ts";
import { useTranslation } from "react-i18next";

/** A language's own name, marked up in that language, plus a "draft" chip while it awaits native review. */
export const LanguageOptionLabel = ({ language }: { readonly language: LanguageId }) => {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-2">
      <span lang={language} dir={directionOf(language)}>
        {nativeName(language)}
      </span>
      {isDraftLanguage(language) ? (
        <Chip size="sm" variant="soft" color="warning">
          {t("settings.language.draft")}
        </Chip>
      ) : null}
    </span>
  );
};

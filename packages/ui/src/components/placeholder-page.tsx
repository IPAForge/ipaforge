import { Card } from "@heroui/react";
import { compact } from "@loadstar/kernel";
import { PageHeader } from "@ui/components/page-header.tsx";
import type { TranslationKey } from "@ui/utils/i18n/i18next-types.ts";
import { useTranslation } from "react-i18next";

interface PlaceholderPageProps {
  readonly titleKey: TranslationKey;
  readonly descriptionKey?: TranslationKey;
}

/** A section's page until its feature lands: the header and an "under construction" note. */
export const PlaceholderPage = ({ titleKey, descriptionKey }: PlaceholderPageProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader {...compact({ titleKey, descriptionKey })} />
      <Card>
        <Card.Content>
          <p className="text-muted">{t("placeholder.body")}</p>
        </Card.Content>
      </Card>
    </div>
  );
};

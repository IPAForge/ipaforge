import { Card } from "@heroui/react";
import { compact } from "@loadstar/kernel";
import { PageHeader } from "@ui/components/page-header.tsx";
import { type ShellKey, t } from "@ui/locales/en-shell.ts";

interface PlaceholderPageProps {
  readonly titleKey: ShellKey;
  readonly descriptionKey?: ShellKey;
}

/** A section's page until its feature lands: the header and an "under construction" note. */
export const PlaceholderPage = ({ titleKey, descriptionKey }: PlaceholderPageProps) => (
  <div className="flex flex-col gap-6">
    <PageHeader {...compact({ titleKey, descriptionKey })} />
    <Card>
      <Card.Content>
        <p className="text-muted">{t("placeholder.body")}</p>
      </Card.Content>
    </Card>
  </div>
);

import { type ShellKey, t } from "@ui/locales/en-shell.ts";

interface PageHeaderProps {
  readonly titleKey: ShellKey;
  readonly descriptionKey?: ShellKey;
}

/** A page's title and optional one-line description. */
export const PageHeader = ({ titleKey, descriptionKey }: PageHeaderProps) => (
  <div className="flex flex-col gap-1">
    <h1 className="font-semibold text-2xl">{t(titleKey)}</h1>
    {descriptionKey ? <p className="text-muted">{t(descriptionKey)}</p> : null}
  </div>
);

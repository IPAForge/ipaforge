import { Separator } from "@heroui/react";
import { SidebarLink } from "@ui/components/shell/sidebar-link.tsx";
import { type SectionGroup, sectionsInGroup } from "@ui/sections.ts";
import { useId } from "react";
import { useTranslation } from "react-i18next";

interface SidebarGroupProps {
  readonly group: SectionGroup;
  /** Every group after the first starts with a separator. */
  readonly isFirst: boolean;
}

/** One group of sidebar links, named by its label when it has one. */
export const SidebarGroup = ({ group, isFirst }: SidebarGroupProps) => {
  const { t } = useTranslation();
  const labelId = useId();
  const { labelKey } = group;
  return (
    <div className="flex flex-col gap-1">
      {!isFirst && <Separator className="my-2" />}
      {labelKey ? (
        <span id={labelId} className="px-3 py-1 font-medium text-muted text-xs uppercase tracking-wider">
          {t(labelKey)}
        </span>
      ) : null}
      <ul aria-labelledby={labelKey ? labelId : undefined} className="flex flex-col gap-1">
        {sectionsInGroup(group.id).map((section) => (
          <li key={section.id}>
            <SidebarLink section={section} />
          </li>
        ))}
      </ul>
    </div>
  );
};

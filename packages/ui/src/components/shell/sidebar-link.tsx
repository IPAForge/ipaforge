import { Link } from "@tanstack/react-router";
import type { AppSection } from "@ui/sections.ts";
import { useTranslation } from "react-i18next";

// The router marks the current route with `aria-current="page"`; the styling keys off that attribute.
const LINK_CLASSES = [
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted outline-none",
  "hover:bg-default hover:text-foreground",
  "focus-visible:ring-2 focus-visible:ring-focus",
  "aria-[current=page]:bg-accent-soft aria-[current=page]:font-medium aria-[current=page]:text-accent-soft-foreground",
].join(" ");

export const SidebarLink = ({ section }: { section: AppSection }) => {
  const { t } = useTranslation();
  const Icon = section.icon;
  return (
    <Link to={section.path} className={LINK_CLASSES}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{t(section.labelKey)}</span>
    </Link>
  );
};

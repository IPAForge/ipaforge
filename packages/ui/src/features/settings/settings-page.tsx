import { PageHeader } from "@ui/components/page-header.tsx";
import { AppearanceSettings } from "@ui/features/settings/appearance-settings.tsx";

/** Settings: one card per group (appearance now; language arrives with translations). */
export const SettingsPage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader titleKey="nav.settings" />
    <AppearanceSettings />
  </div>
);

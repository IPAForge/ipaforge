import { PageHeader } from '@ui/components/page-header.tsx'
import { AppearanceSettings } from '@ui/features/settings/appearance-settings.tsx'
import { LanguageSettings } from '@ui/features/settings/language-settings.tsx'

/** Settings: one card per group (appearance, then language). */
export const SettingsPage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader titleKey="nav.settings" />
    <AppearanceSettings />
    <LanguageSettings />
  </div>
)

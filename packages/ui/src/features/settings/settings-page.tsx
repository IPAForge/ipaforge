import { PageHeader } from '@ui/components/page-header.tsx'
import { AnisetteSettings } from '@ui/features/settings/anisette/components/anisette-settings.tsx'
import { AppearanceSettings } from '@ui/features/settings/components/appearance-settings.tsx'
import { LanguageSettings } from '@ui/features/settings/components/language-settings.tsx'

/** Settings: one card per group (appearance, language, then anisette servers). */
export const SettingsPage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader titleKey="nav.settings" />
    <AppearanceSettings />
    <LanguageSettings />
    <AnisetteSettings />
  </div>
)

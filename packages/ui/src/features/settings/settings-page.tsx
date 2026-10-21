import { PageHeader } from '@ui/components/page-header.tsx'
import { PageTabs } from '@ui/components/page-tabs.tsx'
import { AnisetteSettings } from '@ui/features/settings/anisette/components/anisette-settings.tsx'
import { AppearanceSettings } from '@ui/features/settings/components/appearance-settings.tsx'
import { SetupGuideSettings } from '@ui/features/settings/components/setup-guide-settings.tsx'
import { settingsTabLabelKeys } from '@ui/features/settings/constants.ts'
import { useSettingsTab } from '@ui/features/settings/hooks/use-settings-tab.ts'
import { useAnisetteServers } from '@ui/hooks/queries/use-anisette-servers.ts'

/** Settings in two tabs: General (appearance and language, the setup guide) and Anisette servers. */
export const SettingsPage = () => {
  const [selected, setSelected] = useSettingsTab()
  const servers = useAnisetteServers().data?.servers.length
  const tabs = [
    {
      id: 'general',
      labelKey: settingsTabLabelKeys.general,
      panel: (
        <>
          <AppearanceSettings />
          <SetupGuideSettings />
        </>
      )
    },
    {
      id: 'anisette',
      labelKey: settingsTabLabelKeys.anisette,
      count: servers,
      panel: <AnisetteSettings />
    }
  ] as const

  return (
    <div className="flex flex-col gap-6">
      <PageHeader titleKey="nav.settings" />
      <PageTabs
        labelKey="settings.tabs.label"
        tabs={tabs}
        selected={selected}
        onSelect={setSelected}
      />
    </div>
  )
}

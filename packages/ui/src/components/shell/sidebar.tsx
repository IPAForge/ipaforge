import { useTranslation } from 'react-i18next'

import { AppCredit } from '@ui/components/shell/app-credit.tsx'
import { SidebarGroup } from '@ui/components/shell/sidebar-group.tsx'
import { sectionGroups } from '@ui/sections.ts'

/** Section navigation, with the credit at its foot; on the start edge, so it moves to the right in right-to-left languages. */
export const Sidebar = () => {
  const { t } = useTranslation()

  return (
    <div className="flex w-56 shrink-0 flex-col border-border border-e p-3">
      <nav
        aria-label={t('shell.navigation')}
        className="flex-1 overflow-y-auto"
      >
        {sectionGroups.map((group, index) => (
          <SidebarGroup key={group.id} group={group} isFirst={index === 0} />
        ))}
      </nav>
      <AppCredit />
    </div>
  )
}

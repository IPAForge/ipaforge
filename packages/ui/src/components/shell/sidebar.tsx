import { useTranslation } from 'react-i18next'

import { SidebarGroup } from '@ui/components/shell/sidebar-group.tsx'
import { sectionGroups } from '@ui/sections.ts'

/** Section navigation; on the start edge, so it moves to the right in right-to-left languages. */
export const Sidebar = () => {
  const { t } = useTranslation()

  return (
    <nav
      aria-label={t('shell.navigation')}
      className="w-56 shrink-0 overflow-y-auto border-border border-e p-3"
    >
      {sectionGroups.map((group, index) => (
        <SidebarGroup key={group.id} group={group} isFirst={index === 0} />
      ))}
    </nav>
  )
}

import { useTranslation } from 'react-i18next'

import { PortalCard } from '@ui/features/developer/components/portal-card.tsx'
import { PortalList } from '@ui/features/developer/components/portal-list.tsx'
import { PortalRow } from '@ui/features/developer/components/portal-row.tsx'
import type { PortalData } from '@ui/features/developer/types.ts'

type GroupsPanelProps = {
  groups: PortalData['groups']
}

/** The team's app groups: what apps in one group share. A list only: Apple doesn't say which App IDs use each. */
export const GroupsPanel = ({ groups }: GroupsPanelProps) => {
  const { t } = useTranslation()
  const items = groups.data?.groups ?? []

  return (
    <PortalCard title={t('portal.tabs.groups')} hint={t('portal.groups.hint')}>
      <PortalList
        label={t('portal.tabs.groups')}
        isPending={groups.isPending}
        error={groups.error}
        isEmpty={items.length === 0}
        emptyKey="portal.groups.empty"
      >
        {items.map((group) => (
          <PortalRow
            key={group.id}
            view={{
              id: group.id,
              title: group.name ?? group.identifier,
              tags: [],
              code: group.identifier,
              details: []
            }}
          />
        ))}
      </PortalList>
    </PortalCard>
  )
}

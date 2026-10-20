import { Button } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TeamPicker } from '@ui/features/developer/components/team-picker.tsx'
import { usePortalRefresh } from '@ui/features/developer/hooks/use-portal-refresh.ts'
import type { PortalContext } from '@ui/features/developer/types.ts'

type TeamBarProps = {
  context: PortalContext
}

/**
 * The team the page shows and its Apple ID (a picker when the Apple ID has several teams), and Refresh: Apple's
 * data is read when the page opens and when asked, never in the background.
 */
export const TeamBar = ({ context }: TeamBarProps) => {
  const { t } = useTranslation()
  const refresh = usePortalRefresh(context)
  const [isRefreshing, setRefreshing] = useState(false)
  const { account, team, teams } = context
  const onRefresh = () => {
    setRefreshing(true)
    void refresh().finally(() => setRefreshing(false))
  }
  if (!(account && team)) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {teams.length > 1 ? (
          <TeamPicker teams={teams} team={team} onChange={context.onTeam} />
        ) : (
          <span className="font-semibold">
            {t(team.isFree ? 'portal.team.free' : 'portal.team.paid', {
              name: team.name
            })}
          </span>
        )}
        <span className="break-all text-muted">{account.appleId}</span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onPress={onRefresh}
        isPending={isRefreshing}
      >
        {t('portal.refresh')}
      </Button>
    </div>
  )
}

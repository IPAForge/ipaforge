import { Button } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DeleteAppIdDialog } from '@ui/features/developer/components/delete-app-id-dialog.tsx'
import { PortalCard } from '@ui/features/developer/components/portal-card.tsx'
import { PortalList } from '@ui/features/developer/components/portal-list.tsx'
import { PortalRow } from '@ui/features/developer/components/portal-row.tsx'
import type {
  PortalContext,
  PortalData,
  PortalRowView
} from '@ui/features/developer/types.ts'
import { appOfBundle } from '@ui/features/developer/utils/app-of-bundle.ts'
import { quotaLine } from '@ui/features/developer/utils/quota-line.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { TeamAppId } from '@ui/services/engine/types.ts'

type AppIdsPanelProps = {
  context: PortalContext
  appIds: PortalData['appIds']
}

/**
 * The team's App IDs: the app on the device each belongs to (or "Unused"), when it stops counting on a free team,
 * and Delete for unused ones; for free teams, how many are left this week and when the next one frees.
 */
export const AppIdsPanel = ({ context, appIds }: AppIdsPanelProps) => {
  const { t } = useTranslation()
  const format = useFormat()
  const [deleting, setDeleting] = useState<TeamAppId>()
  const data = appIds.data
  const items = data?.appIds ?? []
  const isFree = data?.team.isFree ?? true
  const onClose = () => setDeleting(undefined)
  const viewOf = (appId: TeamAppId, isUnused: boolean): PortalRowView => {
    const app = appOfBundle(appId.identifier, context.apps)

    return {
      id: appId.id,
      title: app?.name ?? appId.name,
      tags: isUnused
        ? [{ labelKey: 'portal.appIds.unused', tone: 'warn' }]
        : [],
      code: appId.identifier,
      details:
        appId.expiresAt === undefined
          ? []
          : [
              t('portal.appIds.countsUntil', {
                date: format.date(new Date(appId.expiresAt))
              })
            ]
    }
  }

  return (
    <PortalCard
      title={t('portal.tabs.appIds')}
      hint={t(isFree ? 'portal.appIds.hintFree' : 'portal.appIds.hintPaid')}
      summary={data && isFree ? quotaLine(t, format, data) : undefined}
    >
      <PortalList
        label={t('portal.tabs.appIds')}
        isPending={appIds.isPending}
        error={appIds.error}
        isEmpty={items.length === 0}
        emptyKey="portal.appIds.empty"
      >
        {items.map((appId) => {
          // Whether an app uses it is known only from the device's apps.
          const isUnused =
            context.device !== undefined &&
            appOfBundle(appId.identifier, context.apps) === undefined
          const view = viewOf(appId, isUnused)
          const onDelete = () => setDeleting(appId)

          return (
            <PortalRow
              key={view.id}
              view={view}
              actions={
                isUnused ? (
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={onDelete}
                    aria-label={t('portal.appIds.deleteOne', {
                      name: appId.identifier
                    })}
                  >
                    {t('portal.appIds.delete')}
                  </Button>
                ) : undefined
              }
            />
          )
        })}
      </PortalList>
      {deleting ? (
        <DeleteAppIdDialog
          context={context}
          appId={deleting}
          isFree={isFree}
          onClose={onClose}
        />
      ) : null}
    </PortalCard>
  )
}

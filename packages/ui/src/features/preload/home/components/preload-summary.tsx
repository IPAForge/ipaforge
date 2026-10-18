import { Card } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { PlanFact } from '@ui/features/install/home/components/plan-fact.tsx'
import type { PreloadTotals } from '@ui/features/preload/home/types.ts'
import { useFormat } from '@ui/hooks/use-format.ts'

type PreloadSummaryProps = { totals: PreloadTotals }

/**
 * "This install" for the whole list: the new App IDs against what's left this week, the free-app slots after the
 * install (the run asks which app to remove when it would go over), the certificate and the team.
 */
export const PreloadSummary = ({ totals }: PreloadSummaryProps) => {
  const { t } = useTranslation()
  const { date } = useFormat()
  const { newAppIds, available, enough, nextSlotAt, freeApps, team } = totals
  const isOver = freeApps !== undefined && freeApps.after > freeApps.limit
  const freeAppsNoteKey = isOver
    ? 'preload.summary.freeAppsOver'
    : 'install.plan.freeAppsRoom'
  const nextSlot = nextSlotAt
    ? t('install.plan.nextSlot', { date: date(nextSlotAt) })
    : undefined

  return (
    <Card>
      <Card.Header>
        <Card.Title>{t('install.plan.title')}</Card.Title>
      </Card.Header>
      <Card.Content>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-4">
          <PlanFact
            label={t('install.plan.appIds')}
            value={
              available === undefined
                ? t('preload.summary.appIdsNoLimit', { count: newAppIds })
                : t('preload.summary.appIds', {
                    count: newAppIds,
                    left: available
                  })
            }
            note={
              enough
                ? nextSlot
                : t('preload.summary.notEnough', { next: nextSlot ?? '' })
            }
            tone={enough ? '' : 'text-danger-soft-foreground'}
          />
          <PlanFact
            label={t('install.plan.freeApps')}
            value={
              freeApps
                ? t('preload.summary.freeApps', {
                    after: freeApps.after,
                    limit: freeApps.limit
                  })
                : t('install.plan.noLimit')
            }
            note={
              freeApps ? t(freeAppsNoteKey, { used: freeApps.used }) : undefined
            }
            tone={isOver ? 'text-warning-soft-foreground' : ''}
          />
          <PlanFact
            label={t('install.plan.certificate')}
            value={t(
              totals.certificateReused
                ? 'install.plan.certificateReused'
                : 'install.plan.certificateNew'
            )}
          />
          {team ? (
            <PlanFact
              label={t('install.plan.team')}
              value={
                team.isFree
                  ? t('accounts.freeTeam', { name: team.name })
                  : team.name
              }
            />
          ) : null}
        </dl>
      </Card.Content>
    </Card>
  )
}

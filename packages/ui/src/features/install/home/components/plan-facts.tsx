import { useTranslation } from 'react-i18next'

import { PlanFact } from '@ui/features/install/home/components/plan-fact.tsx'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { InstallPlan } from '@ui/services/engine/types.ts'

type PlanFactsProps = { plan: InstallPlan }

/** What the plan says: App IDs, free-app slots, the certificate and the team. */
export const PlanFacts = ({ plan }: PlanFactsProps) => {
  const { t } = useTranslation()
  const { date } = useFormat()
  const { appIds, freeSlots, certificate, team } = plan
  const isFull = freeSlots
    ? freeSlots.occupied.length >= freeSlots.limit
    : false
  const freeAppsNoteKey = isFull
    ? 'install.plan.freeAppsFull'
    : 'install.plan.freeAppsRoom'
  const nextSlot = appIds.nextSlotAt
    ? t('install.plan.nextSlot', { date: date(new Date(appIds.nextSlotAt)) })
    : undefined

  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-4">
      <PlanFact
        label={t('install.plan.appIds')}
        value={t('install.plan.appIdsValue', {
          created: appIds.create.length,
          reused: appIds.reuse.length,
          left: appIds.available
        })}
        note={nextSlot}
        tone={appIds.enough ? '' : 'text-danger-soft-foreground'}
      />
      <PlanFact
        label={t('install.plan.freeApps')}
        value={
          freeSlots
            ? t('install.plan.freeAppsValue', {
                used: freeSlots.occupied.length,
                limit: freeSlots.limit
              })
            : t('install.plan.noLimit')
        }
        note={freeSlots ? t(freeAppsNoteKey) : undefined}
        tone={isFull ? 'text-warning-soft-foreground' : ''}
      />
      <PlanFact
        label={t('install.plan.certificate')}
        value={t(
          certificate.reusable
            ? 'install.plan.certificateReused'
            : 'install.plan.certificateNew'
        )}
        note={
          certificate.reusable
            ? t('install.plan.certificatesOnTeam', {
                count: certificate.onTeam
              })
            : t('install.plan.certificateNewWhy', { count: certificate.onTeam })
        }
      />
      <PlanFact
        label={t('install.plan.team')}
        value={
          team.isFree ? t('accounts.freeTeam', { name: team.name }) : team.name
        }
      />
    </dl>
  )
}

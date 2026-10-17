import { Card } from '@heroui/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { usePlanInstall } from '@ui/hooks/queries/use-plan-install.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { InstallPlan } from '@ui/services/engine/engine-types.ts'

type PlanQuery = ReturnType<typeof usePlanInstall>

type FactProps = {
  label: string
  value: string
  note?: string | undefined
  tone?: string
}

const Fact = ({ label, value, note, tone = '' }: FactProps) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <dt className="text-muted text-xs">{label}</dt>
    <dd className={tone}>{value}</dd>
    {note ? <span className="text-muted text-xs">{note}</span> : null}
  </div>
)

type PlanFactsProps = { plan: InstallPlan }

const PlanFacts = ({ plan }: PlanFactsProps) => {
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
      <Fact
        label={t('install.plan.appIds')}
        value={t('install.plan.appIdsValue', {
          uses: appIds.create.length,
          left: appIds.available
        })}
        note={nextSlot}
        tone={appIds.enough ? '' : 'text-danger'}
      />
      <Fact
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
        tone={isFull ? 'text-warning' : ''}
      />
      <Fact
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
      <Fact
        label={t('install.plan.team')}
        value={
          team.isFree ? t('accounts.freeTeam', { name: team.name }) : team.name
        }
      />
    </dl>
  )
}

type WaitingProps = { children: ReactNode }

/** Why there's nothing to show yet: being read, or waiting for the device or a sign-in. */
const Waiting = ({ children }: WaitingProps) => (
  <p className="text-muted text-sm">{children}</p>
)

type ThisInstallProps = {
  plan: PlanQuery
  /** The plan isn't asked for until the device and the Apple ID are ready. */
  isWaiting: boolean
  /** The app being planned, named while it downloads. */
  app: string
}

/**
 * "This install": the App IDs it uses and how many are left this week, the free-app slots on the device, whether
 * the certificate is reused, and the team. From the Engine's read-only plan, read when the device, Apple ID or
 * choice changes; never polled.
 */
export const ThisInstall = ({ plan, isWaiting, app }: ThisInstallProps) => {
  const { t } = useTranslation()
  const body = () => {
    if (isWaiting) return <Waiting>{t('install.plan.waiting')}</Waiting>
    if (plan.data) return <PlanFacts plan={plan.data} />
    if (plan.error) return <Waiting>{t('install.plan.unavailable')}</Waiting>
    return <Waiting>{t('install.plan.checking', { app })}</Waiting>
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>{t('install.plan.title')}</Card.Title>
      </Card.Header>
      <Card.Content>{body()}</Card.Content>
    </Card>
  )
}

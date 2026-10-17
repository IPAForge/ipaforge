import { Card } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { PlanFacts } from '@ui/features/install/home/components/plan-facts.tsx'
import { Waiting } from '@ui/features/install/home/components/waiting.tsx'
import type { PlanQuery } from '@ui/features/install/home/types.ts'

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

import { useTranslation } from 'react-i18next'

import {
  expiryDotClasses,
  expiryTextClasses
} from '@ui/features/apps/constants.ts'
import type { AppView } from '@ui/features/apps/types.ts'
import { useFormat } from '@ui/hooks/use-format.ts'

type ExpiryLabelProps = { view: AppView }

/**
 * "Expires in 4 days · 23 Oct", "Expires today", "Expired 2 days ago · won't open", with its colour; "Expired · won't
 * open" once iOS has removed its profile.
 */
export const ExpiryLabel = ({ view }: ExpiryLabelProps) => {
  const { t } = useTranslation()
  const { date } = useFormat()
  const { daysLeft, daysShown, tone } = view
  const expiresAt = view.app.expiresAt

  const words = () => {
    if (view.app.profileGone) return t('apps.expiry.gone')
    if (daysLeft === undefined || daysShown === undefined || !expiresAt)
      return t('apps.expiry.unknown')
    if (daysLeft <= 0)
      return t('apps.expiry.expired', { days: Math.max(1, -daysShown) })
    if (daysShown <= 0) return t('apps.expiry.today')

    return t('apps.expiry.in', { days: daysShown, date: date(expiresAt) })
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium text-xs ${expiryTextClasses[tone]}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 rounded-full ${expiryDotClasses[tone]}`}
      />
      {words()}
    </span>
  )
}

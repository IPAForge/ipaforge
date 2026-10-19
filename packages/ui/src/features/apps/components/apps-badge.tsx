import { useTranslation } from 'react-i18next'

import { useApps } from '@ui/features/apps/hooks/use-apps.ts'

/** On Apps in the sidebar: how many apps are due for a refresh (expiring soon, or expired). */
export const AppsBadge = () => {
  const { t } = useTranslation()
  const { due } = useApps()

  if (due.length === 0) return null

  return (
    <span className="ms-auto rounded-full bg-warning px-1.5 font-semibold text-warning-foreground text-xs tabular-nums">
      <span aria-hidden="true">{due.length}</span>
      <span className="sr-only">{t('apps.badge', { count: due.length })}</span>
    </span>
  )
}

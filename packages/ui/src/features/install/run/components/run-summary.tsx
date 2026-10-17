import { useTranslation } from 'react-i18next'

import type { RunTarget, SummaryItem } from '@ui/features/install/run/types.ts'
import { useAppIdQuota } from '@ui/hooks/queries/use-app-id-quota.ts'

type RunSummaryProps = { target: RunTarget; accountId: string }

/**
 * "This install" as one full-width strip over the steps: the app, channel, device, Apple ID and, when known, the
 * App IDs left this week. It wraps onto more lines in a narrow window.
 */
export const RunSummary = ({ target, accountId }: RunSummaryProps) => {
  const { t } = useTranslation()
  const quota = useAppIdQuota({ accountId }).data?.quota
  const info = target.check?.info
  const items: SummaryItem[] = [
    { labelKey: 'install.summary.app', value: target.app },
    { labelKey: 'install.summary.channel', value: target.channel },
    {
      labelKey: 'install.summary.device',
      value: info
        ? t('install.summary.deviceValue', {
            name: target.deviceName,
            ios: info.productVersion
          })
        : target.deviceName
    },
    { labelKey: 'install.summary.account', value: target.appleId },
    ...(quota
      ? [
          {
            labelKey: 'install.summary.appIds',
            value: t('install.summary.appIdsValue', { count: quota.available })
          } satisfies SummaryItem
        ]
      : [])
  ]

  return (
    <dl
      aria-label={t('install.summary.title')}
      className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3"
    >
      {items.map((item) => (
        <div key={item.labelKey} className="flex min-w-0 flex-col">
          <dt className="text-muted text-xs">{t(item.labelKey)}</dt>
          <dd className="break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

import { useTranslation } from 'react-i18next'

import type { AppView } from '@ui/features/apps/types.ts'
import type { AutoRefreshSettings } from '@ui/state/auto-refresh/types.ts'

type AppsFactsProps = {
  managed: readonly AppView[]
  settings: AutoRefreshSettings
}

/** The next app to expire, how many apps IPAForge keeps refreshed, and whether it does so by itself. */
export const AppsFacts = ({ managed, settings }: AppsFactsProps) => {
  const { t } = useTranslation()
  const next = managed.find((view) => view.daysLeft !== undefined)

  const nextText = () => {
    if (!next || next.daysLeft === undefined) return t('apps.facts.none')
    if (next.daysLeft <= 0)
      return t('apps.facts.nextExpired', { name: next.app.name })

    return t('apps.facts.nextIn', {
      name: next.app.name,
      days: Math.max(0, next.daysShown ?? 0)
    })
  }

  const facts = [
    { label: t('apps.facts.next'), value: nextText() },
    {
      label: t('apps.facts.count'),
      value: t('apps.facts.apps', { count: managed.length })
    },
    {
      label: t('apps.facts.auto'),
      value: settings.isOn
        ? t('apps.facts.autoOn', { days: settings.daysBefore })
        : t('apps.facts.autoOff')
    }
  ]

  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
      {facts.map((fact) => (
        <div
          key={fact.label}
          className="flex flex-col gap-0.5 rounded-xl border border-border bg-surface px-3 py-2.5"
        >
          <dt className="text-muted text-xs">{fact.label}</dt>
          <dd className="m-0 font-semibold">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}

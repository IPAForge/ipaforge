import { Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { manualChecks } from '@ui/features/repair/constants.ts'

/** What only you can check, on the iPhone: SideStore's VPN and its anisette server. */
export const ManualChecks = () => {
  const { t } = useTranslation()

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-muted text-xs uppercase tracking-wide">
        {t('repair.manual.title')}
      </h2>
      <ul
        aria-label={t('repair.manual.title')}
        className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface"
      >
        {manualChecks.map((check) => (
          <li
            key={check.title}
            className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5 px-4 py-3"
          >
            <Smartphone
              aria-hidden="true"
              className="mt-0.5 size-5 text-muted"
            />
            <span className="font-semibold">{t(check.title)}</span>
            <span className="self-center rounded-full bg-surface-tertiary px-2 py-0.5 text-muted text-xs">
              {t('repair.manual.tag')}
            </span>
            <span className="col-start-2 col-end-4 text-muted text-sm">
              {t(check.body)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

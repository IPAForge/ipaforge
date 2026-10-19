import { useTranslation } from 'react-i18next'

import { checkStateLooks } from '@ui/features/repair/constants.ts'
import type { CheckRow } from '@ui/features/repair/types.ts'

type CheckItemProps = { row: CheckRow }

/** One check: its mark, what it checks, how it came out (a tag) and what that means. */
export const CheckItem = ({ row }: CheckItemProps) => {
  const { t } = useTranslation()
  const look = checkStateLooks[row.state]
  const Icon = look.icon

  return (
    <li
      data-checking={row.state === 'checking' || undefined}
      className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5 px-4 py-3"
    >
      <Icon aria-hidden="true" className={`mt-0.5 size-5 ${look.tone}`} />
      <span className="font-semibold">{t(row.titleKey, row.values ?? {})}</span>
      <span
        className={`self-center rounded-full px-2 py-0.5 text-xs ${look.tag}`}
      >
        {t(row.tagKey, row.values ?? {})}
      </span>
      {row.state === 'checking' ? null : (
        <span className="col-start-2 col-end-4 text-muted text-sm">
          {t(row.detailKey, row.values ?? {})}
        </span>
      )}
    </li>
  )
}

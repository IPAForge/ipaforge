import { useTranslation } from 'react-i18next'

import { CheckItem } from '@ui/features/repair/components/check-item.tsx'
import type { CheckRow } from '@ui/features/repair/types.ts'

type CheckListProps = { rows: readonly CheckRow[] }

/** The checks, one line each, in one box. */
export const CheckList = ({ rows }: CheckListProps) => {
  const { t } = useTranslation()

  return (
    <ul
      aria-label={t('repair.checks')}
      className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface"
    >
      {rows.map((row) => (
        <CheckItem key={row.id} row={row} />
      ))}
    </ul>
  )
}

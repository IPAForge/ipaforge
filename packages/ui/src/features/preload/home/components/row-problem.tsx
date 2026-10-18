import { useTranslation } from 'react-i18next'

import type { RowProblem as Problem } from '@ui/features/preload/home/types.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

type RowProblemProps = { problem: Problem }

/** Why an app can't be installed: "Can't be installed." then the reason, and what to do in muted text. */
export const RowProblem = ({ problem }: RowProblemProps) => {
  const { t } = useTranslation()
  const reason =
    problem.kind === 'needs-ios'
      ? t('preload.problem.needsIos', {
          needs: problem.needs,
          has: problem.has
        })
      : t(problem.key as TranslationKey)

  return (
    <p className="col-span-2 col-start-2 text-sm">
      <span className="text-danger-soft-foreground">
        {t('preload.row.cannot')} {reason}
      </span>
      {problem.kind === 'message' && problem.detailKey ? (
        <span className="text-muted">
          {' '}
          {t(problem.detailKey as TranslationKey)}
        </span>
      ) : null}
    </p>
  )
}

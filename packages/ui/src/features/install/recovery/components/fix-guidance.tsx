import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { FixLink } from '@ui/features/install/recovery/components/fix-link.tsx'
import type { Fix } from '@ui/features/install/recovery/types.ts'

type FixGuidanceProps = {
  fix: Fix
  /** A line that depends on this failure (when the next App ID frees). */
  note?: ReactNode
}

/** What to do for a fix: a sentence, steps, and an Apple page to open, as the fix has them. */
export const FixGuidance = ({ fix, note }: FixGuidanceProps) => {
  const { t } = useTranslation()

  return (
    <>
      {fix.howKey ? (
        <p className="text-muted text-sm">{t(fix.howKey)}</p>
      ) : null}
      {fix.stepKeys ? (
        <ol className="list-decimal ps-5 text-muted text-sm">
          {fix.stepKeys.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ol>
      ) : null}
      {note ? <p className="text-sm">{note}</p> : null}
      {fix.link ? <FixLink url={fix.link} /> : null}
    </>
  )
}

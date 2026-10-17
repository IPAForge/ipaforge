import type { ReactNode } from 'react'

import { outcomeToneClasses } from '@ui/features/install/run/constants.ts'
import type { OutcomeTone } from '@ui/features/install/run/types.ts'

type OutcomeBoxProps = {
  tone: OutcomeTone
  title: ReactNode
  children: ReactNode
  actions: ReactNode
}

/** A tinted box like the device notices: the title in its tone, the text, and its buttons under it. */
export const OutcomeBox = ({
  tone,
  title,
  children,
  actions
}: OutcomeBoxProps) => (
  <div
    role="status"
    className={`flex flex-col gap-1 rounded-xl px-4 py-3 ${outcomeToneClasses[tone].box}`}
  >
    <p className={`font-semibold ${outcomeToneClasses[tone].title}`}>{title}</p>
    <div className="text-muted text-sm">{children}</div>
    <div className="mt-2 flex flex-wrap items-center gap-2">{actions}</div>
  </div>
)

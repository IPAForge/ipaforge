import type { ReactNode } from 'react'

import { checkLooks } from '@ui/features/guide/constants.ts'
import type { CheckState } from '@ui/features/guide/types.ts'

type CheckRowProps = {
  state: CheckState
  title: string
  children: ReactNode
  /** A button beside the text (Copy, Show the option). */
  action?: ReactNode
}

/** One thing the guide checks: its state, what it is, what was found or what to do, and a button when one helps. */
export const CheckRow = ({ state, title, children, action }: CheckRowProps) => {
  const look = checkLooks[state]

  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-xl border border-border bg-surface px-3 py-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_auto]">
      <span
        aria-hidden="true"
        className={`grid size-7 place-items-center rounded-full font-bold text-sm ${look.classes}`}
      >
        {look.mark}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold">{title}</p>
        <div className="text-muted text-sm">{children}</div>
      </div>
      {action ? (
        <div className="col-start-2 sm:col-start-3 sm:row-start-1 sm:self-center">
          {action}
        </div>
      ) : null}
    </li>
  )
}

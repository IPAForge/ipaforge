import type { ReactNode } from 'react'

import { RowTagChip } from '@ui/features/developer/components/row-tag-chip.tsx'
import type { PortalRowView } from '@ui/features/developer/types.ts'

type PortalRowProps = {
  view: PortalRowView
  /** Its buttons, beside the text in a wide row and under it in a narrow one. */
  actions?: ReactNode | undefined
}

/** One thing the team holds: its name and tags, its identifier and details, and what can be done with it. */
export const PortalRow = ({ view, actions }: PortalRowProps) => (
  <li className="@container rounded-xl border border-border bg-surface px-3 py-2.5">
    <div className="grid grid-cols-1 items-start gap-2 @xl:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
          {view.title}
          {view.tags.map((tag) => (
            <RowTagChip key={tag.labelKey} tag={tag} />
          ))}
        </p>
        {view.code ? (
          <p className="break-all font-mono text-muted text-xs">{view.code}</p>
        ) : null}
        {view.details.map((detail) => (
          <p key={detail} className="text-muted text-xs">
            {detail}
          </p>
        ))}
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2 @xl:justify-end">{actions}</div>
      ) : null}
    </div>
  </li>
)

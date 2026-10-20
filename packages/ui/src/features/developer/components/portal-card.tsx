import type { ReactNode } from 'react'

type PortalCardProps = {
  title: string
  hint: string
  /** A button beside the title (Remove unused). */
  action?: ReactNode | undefined
  /** The limit line under the hint: "2 of 2 used", "4 left this week". */
  summary?: string | undefined
  children: ReactNode
}

/** A tab's content: what the list is, how its limits stand, and the list itself. */
export const PortalCard = ({
  title,
  hint,
  action,
  summary,
  children
}: PortalCardProps) => (
  <section className="flex flex-col gap-3" aria-label={title}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 max-w-prose flex-col gap-1">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-muted text-sm">{hint}</p>
      </div>
      {action}
    </div>
    {summary ? (
      <p className="rounded-lg bg-surface-secondary px-3 py-2 font-medium text-sm">
        {summary}
      </p>
    ) : null}
    {children}
  </section>
)

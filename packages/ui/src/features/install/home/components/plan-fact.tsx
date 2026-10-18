type PlanFactProps = {
  label: string
  value: string
  note?: string | undefined
  tone?: string
}

/** One fact about the install: a label over its value, and a note under it. */
export const PlanFact = ({ label, value, note, tone = '' }: PlanFactProps) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <dt className="text-muted text-xs">{label}</dt>
    <dd className={tone}>{value}</dd>
    {note ? <dd className="text-muted text-xs">{note}</dd> : null}
  </div>
)

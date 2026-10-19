type DetailFactProps = {
  label: string
  value: string
  note?: string | undefined
}

/** One fact about an app in its details: a label, the value, and an optional line under it. */
export const DetailFact = ({ label, value, note }: DetailFactProps) => (
  <div className="flex flex-col gap-1">
    <dt className="text-muted text-xs">{label}</dt>
    <dd className="m-0">{value}</dd>
    {note ? <span className="text-muted text-xs">{note}</span> : null}
  </div>
)

type DeviceFactProps = {
  label: string
  children: string
  className?: string
}

/** A label over its value, in the card's facts grid. */
export const DeviceFact = ({
  label,
  children,
  className = ''
}: DeviceFactProps) => (
  <div className={`flex min-w-0 flex-col ${className}`}>
    <dt className="text-muted text-xs">{label}</dt>
    <dd className="truncate text-sm" title={children}>
      {children}
    </dd>
  </div>
)

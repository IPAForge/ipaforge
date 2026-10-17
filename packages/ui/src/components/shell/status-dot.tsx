/** How a device or Apple ID is doing: ready, needs attention, blocked, or nothing there. */
export type StatusTone = 'ready' | 'warning' | 'danger' | 'off'

const toneClasses = {
  ready: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  off: 'bg-muted'
} as const satisfies Record<StatusTone, string>

type StatusDotProps = { tone: StatusTone }

/** A small coloured dot for a status. Decorative: the status is also said in words next to it. */
export const StatusDot = ({ tone }: StatusDotProps) => (
  <span
    aria-hidden="true"
    data-tone={tone}
    className={`size-2 shrink-0 rounded-full ${toneClasses[tone]}`}
  />
)

import { statusDotClasses } from '@ui/components/shell/constants.ts'
import type { StatusTone } from '@ui/components/shell/types.ts'

type StatusDotProps = { tone: StatusTone }

/** A small coloured dot for a status. Decorative: the status is also said in words next to it. */
export const StatusDot = ({ tone }: StatusDotProps) => (
  <span
    aria-hidden="true"
    data-tone={tone}
    className={`size-2 shrink-0 rounded-full ${statusDotClasses[tone]}`}
  />
)

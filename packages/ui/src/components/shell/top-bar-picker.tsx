import { Dropdown } from '@heroui/react'
import { ChevronDown } from 'lucide-react'
import { type Key, type ReactNode, useId } from 'react'

import { compact } from '@loadstar/kernel'
import { StatusDot, type StatusTone } from '@ui/components/shell/status-dot.tsx'

export type TopBarPickerProps = {
  /** What is picked ("Device"); with the value it names the button. */
  label: string
  /** The current choice, or its placeholder ("None"). */
  value: string
  tone: StatusTone
  /** A state worth saying in words next to the value ("Sign-in needed"), in the tone's colour. */
  status?: string | undefined
  menuLabel: string
  /** For action items outside a selection section ("Add Apple ID…"). */
  onAction?: ((key: Key) => void) | undefined
  /** The menu opened or closed (the device picker reads every device's status again when it opens). */
  onOpenChange?: ((isOpen: boolean) => void) | undefined
  /** The menu: `Dropdown.Section`s of `Dropdown.Item`s. */
  children: ReactNode
}

const statusClasses = {
  ready: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  off: 'text-muted'
} as const satisfies Record<StatusTone, string>

const triggerClasses = [
  'flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-secondary px-2.5 py-1.5 text-sm outline-none',
  'hover:bg-surface-tertiary focus-visible:ring-2 focus-visible:ring-focus'
].join(' ')

/** A menu button in the top bar: status dot, label and current value, opening a menu of choices. */
export const TopBarPicker = ({
  label,
  value,
  tone,
  status,
  menuLabel,
  onAction,
  onOpenChange,
  children
}: TopBarPickerProps) => {
  const labelId = useId()
  const valueId = useId()
  const statusId = useId()

  return (
    <Dropdown {...compact({ onOpenChange })}>
      <Dropdown.Trigger
        aria-labelledby={
          status ? `${labelId} ${valueId} ${statusId}` : `${labelId} ${valueId}`
        }
        className={triggerClasses}
      >
        <StatusDot tone={tone} />
        <span id={labelId} className="text-muted text-xs">
          {label}
        </span>
        <span id={valueId} className="min-w-0 max-w-56 truncate">
          {value}
        </span>
        {status ? (
          <span
            id={statusId}
            className={`shrink-0 text-xs ${statusClasses[tone]}`}
          >
            {status}
          </span>
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted"
        />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="w-80 max-w-[90vw]">
        <Dropdown.Menu aria-label={menuLabel} {...compact({ onAction })}>
          {children}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

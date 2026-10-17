import { Dropdown, Label } from '@heroui/react'

import { StatusDot } from '@ui/components/shell/status-dot.tsx'
import type { StatusTone } from '@ui/components/shell/types.ts'

type PickerItemProps = {
  id: string
  title: string
  subtitle: string
  tone: StatusTone
  isDisabled?: boolean
}

/** One choice in a top bar menu: status dot, name, and a line about its state. */
export const PickerItem = ({
  id,
  title,
  subtitle,
  tone,
  isDisabled = false
}: PickerItemProps) => (
  <Dropdown.Item id={id} textValue={title} isDisabled={isDisabled}>
    <StatusDot tone={tone} />
    <div className="flex min-w-0 flex-col">
      <Label className="truncate">{title}</Label>
      <span className="truncate text-muted text-xs">{subtitle}</span>
    </div>
    <Dropdown.ItemIndicator />
  </Dropdown.Item>
)

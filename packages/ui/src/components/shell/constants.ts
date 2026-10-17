import type { StatusTone } from '@ui/components/shell/types.ts'

/** The `main` element the skip link jumps to. */
export const MAIN_CONTENT_ID = 'main-content'

/** The Apple ID menu's "Add Apple ID…" item. */
export const ADD_APPLE_ID = 'add-apple-id'

/** The device menu's "Open Devices" item. */
export const OPEN_DEVICES = 'open-devices'

// The router marks the current route with `aria-current="page"`; the styling keys off that attribute.
export const LINK_CLASSES = [
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted outline-none',
  'hover:bg-default hover:text-foreground',
  'focus-visible:ring-2 focus-visible:ring-focus',
  'aria-[current=page]:bg-accent-soft aria-[current=page]:font-medium aria-[current=page]:text-accent-soft-foreground'
].join(' ')

/** A status dot's colour. */
export const statusDotClasses = {
  ready: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  off: 'bg-muted'
} as const satisfies Record<StatusTone, string>

/** A status said in words next to a picker's value, in its tone's colour. */
export const statusTextClasses = {
  ready: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  off: 'text-muted'
} as const satisfies Record<StatusTone, string>

export const PICKER_TRIGGER_CLASSES = [
  'flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-secondary px-2.5 py-1.5 text-sm outline-none',
  'hover:bg-surface-tertiary focus-visible:ring-2 focus-visible:ring-focus'
].join(' ')

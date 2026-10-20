import type { StatusTone } from '@ui/components/shell/types.ts'

/** Who made IPAForge, as the sidebar's credit names them. */
export const AUTHOR = 'Dan Motpan'

/** The year the copyright notice names (the first release's). */
export const COPYRIGHT_YEAR = '2026'

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
  warning: 'text-warning-soft-foreground',
  danger: 'text-danger-soft-foreground',
  off: 'text-muted'
} as const satisfies Record<StatusTone, string>

export const PICKER_TRIGGER_CLASSES = [
  'flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-secondary px-2.5 py-1.5 text-sm outline-none',
  'hover:bg-surface-tertiary focus-visible:ring-2 focus-visible:ring-focus'
].join(' ')

/** The app icon's colours (`apps/desktop/build/icon.svg`), for the mark in the top bar. */
export const logoColors = {
  tileFrom: '#312e81',
  tileTo: '#0f172a',
  sparkFrom: '#fde68a',
  sparkTo: '#f97316',
  phone: '#e0e7ff'
} as const

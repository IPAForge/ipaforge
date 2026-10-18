import type { ReactNode } from 'react'

type RowChipProps = {
  tone?: 'plain' | 'accent'
  children: ReactNode
}

/** A small fact about an app in the list (its App IDs, that it updates). */
export const RowChip = ({ tone = 'plain', children }: RowChipProps) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full bg-surface-secondary px-2 py-0.5 text-xs ${tone === 'accent' ? 'text-accent' : 'text-muted'}`}
  >
    {children}
  </span>
)

import type { selectionKeys } from '@ui/state/selection/constants.ts'

export type SelectionKind = keyof typeof selectionKeys

/** The id picked for each kind (an account id, a device's UDID); missing until something is picked. */
export type Selection = Readonly<Partial<Record<SelectionKind, string>>>

export type SelectionStore = {
  getState: () => Selection
  subscribe: (listener: () => void) => () => void
  select: (kind: SelectionKind, id: string) => void
}

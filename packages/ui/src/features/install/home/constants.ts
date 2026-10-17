import type { SideStoreVariant } from '@ui/services/engine/types.ts'

/** What can be installed, in display order. */
export const variants = [
  'sidestore',
  'livecontainer'
] as const satisfies readonly SideStoreVariant[]

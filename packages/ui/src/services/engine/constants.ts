import type { Channel, SideStoreVariant } from '@ui/services/engine/types.ts'

export const channels = ['stable', 'nightly'] as const satisfies Channel[]

/** The catalog app each variant installs. */
export const variantAppId = {
  sidestore: 'sidestore',
  livecontainer: 'livecontainer-sidestore'
} as const satisfies Record<SideStoreVariant, string>

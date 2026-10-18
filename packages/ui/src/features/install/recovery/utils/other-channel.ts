import type { Channel } from '@ui/services/engine/types.ts'

/** The channel a run didn't use: Nightly after Stable, Stable after Nightly. */
export const otherChannel = (channel: Channel | undefined): Channel =>
  channel === 'nightly' ? 'stable' : 'nightly'

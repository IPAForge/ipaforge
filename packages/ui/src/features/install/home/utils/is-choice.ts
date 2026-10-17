import { variants } from '@ui/features/install/home/constants.ts'
import { channels } from '@ui/services/engine/constants.ts'
import type { Channel, SideStoreVariant } from '@ui/services/engine/types.ts'

export const isChannel = (value: string): value is Channel =>
  (channels as readonly string[]).includes(value)

export const isVariant = (value: string): value is SideStoreVariant =>
  (variants as readonly string[]).includes(value)

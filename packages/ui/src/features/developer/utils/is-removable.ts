import { isPast } from '@ui/features/developer/utils/is-past.ts'
import type { DeviceProfile } from '@ui/services/engine/types.ts'

/** A profile safe to remove: no installed app uses it, or it has expired. */
export const isRemovable = (profile: DeviceProfile): boolean =>
  !profile.isUsed || isPast(profile.expiresAt)

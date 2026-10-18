// What a device's status query says about it, as the device picker, the Devices page and the Install page show it.
import { toIPAForgeError } from '@ipaforge/kernel'
import { UNTRUSTED } from '@ui/features/devices/constants.ts'
import type { DeviceState, StatusQuery } from '@ui/features/devices/types.ts'

/** The state the last read saw; while a read is under way, "checking". */
export const deviceState = (
  { data, error, isFetching }: StatusQuery,
  isConnected: boolean
): DeviceState => {
  if (!isConnected) return 'notConnected'
  if (isFetching || (!data && !error)) return 'checking'
  if (error)
    return UNTRUSTED.has(toIPAForgeError(error).code)
      ? 'notTrusted'
      : 'unavailable'
  if (!data) return 'checking'
  if (data.locked) return 'locked'
  if (data.developerMode === 'off') return 'developerModeOff'
  return 'ready'
}

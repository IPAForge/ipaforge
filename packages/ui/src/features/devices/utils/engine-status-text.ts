import type { TFunction } from 'i18next'

import { toLoadstarError } from '@loadstar/kernel'
import type { DevicesQuery } from '@ui/features/devices/types.ts'
import { errorTitleKey } from '@ui/i18n/required-keys.ts'

/** The line in words: the failure's title, the device count, or that the Engine is still being reached. */
export const engineStatusText = (
  t: TFunction,
  devices: DevicesQuery
): string => {
  if (devices.error)
    return t('devices.engine.failed', {
      reason: t(errorTitleKey(toLoadstarError(devices.error).code))
    })
  if (devices.data)
    return t('devices.engine.connected', { count: devices.data.length })
  return t('devices.engine.connecting')
}

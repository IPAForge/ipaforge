import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import { toLoadstarError } from '@loadstar/kernel'
import { StatusDot } from '@ui/components/shell/status-dot.tsx'
import { useDevices } from '@ui/hooks/queries/use-devices.ts'
import { errorTitleKey } from '@ui/i18n/required-keys.ts'

type DevicesQuery = ReturnType<typeof useDevices>

/** The line in words: the failure's title, the device count, or that the Engine is still being reached. */
const statusText = (t: TFunction, devices: DevicesQuery): string => {
  if (devices.error)
    return t('devices.engine.failed', {
      reason: t(errorTitleKey(toLoadstarError(devices.error).code))
    })
  if (devices.data)
    return t('devices.engine.connected', { count: devices.data.length })
  return t('devices.engine.connecting')
}

/** Whether the Engine answers, and how many devices it sees: the Devices page's first line. */
export const EngineStatus = () => {
  const { t } = useTranslation()
  const devices = useDevices()

  return (
    <p role="status" className="flex items-center gap-2 text-muted text-sm">
      <StatusDot tone={devices.data ? 'ready' : 'off'} />
      {statusText(t, devices)}
    </p>
  )
}

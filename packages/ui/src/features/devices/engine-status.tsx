import { useTranslation } from 'react-i18next'

import { toLoadstarError } from '@loadstar/kernel'
import { StatusDot } from '@ui/components/shell/status-dot.tsx'
import { useDevices } from '@ui/hooks/queries/use-devices.ts'
import { errorTitleKey } from '@ui/i18n/required-keys.ts'

/** Whether the Engine answers, and how many devices it sees: the Devices page's first line until its list lands. */
export const EngineStatus = () => {
  const { t } = useTranslation()
  const devices = useDevices()
  const text = devices.error
    ? t('devices.engine.failed', {
        reason: t(errorTitleKey(toLoadstarError(devices.error).code))
      })
    : devices.data
      ? t('devices.engine.connected', { count: devices.data.length })
      : t('devices.engine.connecting')

  return (
    <p role="status" className="flex items-center gap-2 text-muted text-sm">
      <StatusDot isOn={devices.data !== undefined} />
      {text}
    </p>
  )
}

import { useTranslation } from 'react-i18next'

import { StatusDot } from '@ui/components/shell/status-dot.tsx'
import { engineStatusText } from '@ui/features/devices/utils/engine-status-text.ts'
import { useDevices } from '@ui/hooks/queries/use-devices.ts'

/** Whether the Engine answers, and how many devices it sees: the Devices page's first line. */
export const EngineStatus = () => {
  const { t } = useTranslation()
  const devices = useDevices()

  return (
    <p role="status" className="flex items-center gap-2 text-muted text-sm">
      <StatusDot tone={devices.data ? 'ready' : 'off'} />
      {engineStatusText(t, devices)}
    </p>
  )
}

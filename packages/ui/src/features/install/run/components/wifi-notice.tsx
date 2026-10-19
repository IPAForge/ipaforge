import { Alert } from '@heroui/react'
import { Wifi } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { RunView } from '@ui/state/active-run/types.ts'

type WifiNoticeProps = { view: RunView }

/** While a run installs over Wi-Fi: a cable is much faster for large apps (the apps are sent compressed meanwhile). */
export const WifiNotice = ({ view }: WifiNoticeProps) => {
  const { t } = useTranslation()
  const device = view.steps.find((step) => step.report?.kind === 'device')
  const isWifi =
    device?.report?.kind === 'device' && device.report.connection === 'network'
  const isRunning = view.status === 'running' || view.status === 'waiting'

  if (!(isWifi && isRunning)) return null

  return (
    <Alert status="warning">
      <Alert.Indicator>
        <Wifi aria-hidden="true" className="size-4" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{t('install.run.wifi.title')}</Alert.Title>
        <Alert.Description>{t('install.run.wifi.body')}</Alert.Description>
      </Alert.Content>
    </Alert>
  )
}

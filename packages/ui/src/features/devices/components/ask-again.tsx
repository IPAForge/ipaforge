import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { usePairDevice } from '@ui/features/devices/hooks/use-pair-device.ts'

type AskAgainProps = { udid: string }

/** Asks the device to trust this computer again, busy until the device answers. */
export const AskAgain = ({ udid }: AskAgainProps) => {
  const { t } = useTranslation()
  const pair = usePairDevice(udid)
  const onAskAgain = () => pair.mutate()

  return (
    <Button size="sm" onPress={onAskAgain} isPending={pair.isPending}>
      {pair.isPending
        ? t('devices.notice.notTrusted.waiting')
        : t('devices.notice.notTrusted.action')}
    </Button>
  )
}

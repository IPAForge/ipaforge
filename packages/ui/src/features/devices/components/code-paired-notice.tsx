import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { DeviceNotice } from '@ui/features/devices/components/device-notice.tsx'
import { NoticeBox } from '@ui/features/devices/components/notice-box.tsx'
import type { DeviceKind, DeviceView } from '@ui/features/devices/types.ts'

type CodePairedNoticeProps = {
  udid: string
  view: DeviceView
  name: string
  kind: DeviceKind | undefined
  onPairAgain: () => void
}

/**
 * What an Apple TV or Vision Pro that isn't ready needs: back on the network (woken, or put on), paired again (it
 * refuses the pairing, as after an OS update), or what any device needs (unlocked, Developer Mode on).
 */
export const CodePairedNotice = ({
  udid,
  view,
  name,
  kind,
  onPairAgain
}: CodePairedNoticeProps) => {
  const { t } = useTranslation()
  if (view.state === 'notConnected')
    return (
      <NoticeBox
        status="warning"
        title={t('devices.notice.offNetwork.title', { name })}
        body={
          kind === 'vision'
            ? t('devices.notice.offNetwork.vision')
            : t('devices.notice.offNetwork.tv')
        }
      />
    )
  if (view.state === 'notTrusted')
    return (
      <NoticeBox
        status="warning"
        title={t('devices.notice.pairAgain.title', { name })}
        body={t('devices.notice.pairAgain.body')}
        action={
          <Button size="sm" onPress={onPairAgain}>
            {t('devices.notice.pairAgain.action')}
          </Button>
        }
      />
    )

  return <DeviceNotice udid={udid} view={view} showCheckAgain={false} />
}

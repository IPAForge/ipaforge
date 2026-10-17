import { useTranslation } from 'react-i18next'

import { CheckAgain } from '@ui/features/devices/components/check-again.tsx'
import { NoticeBox } from '@ui/features/devices/components/notice-box.tsx'
import type { NoticeProps } from '@ui/features/devices/types.ts'
import { noticeFor } from '@ui/features/devices/utils/notice-for.tsx'

type DeviceNoticeProps = NoticeProps & {
  /** Off where the device's card already has Check again next to its name. */
  showCheckAgain?: boolean
}

/** A device that isn't ready: what is wrong, how to fix it, and Check again (or Ask again for Trust). */
export const DeviceNotice = ({
  showCheckAgain = true,
  ...props
}: DeviceNoticeProps) => {
  const { t } = useTranslation()
  const notice = noticeFor(t, props.view.state, props)
  if (!notice) return null
  const checkAgain =
    notice.checkAgain && showCheckAgain ? (
      <CheckAgain udid={props.udid} />
    ) : null

  return (
    <NoticeBox
      status={notice.status}
      title={notice.title}
      body={notice.body}
      action={notice.action ?? checkAgain}
    />
  )
}

import { Button } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useDeviceChecklist } from '@ui/features/devices/checklist/hooks/use-device-checklist.ts'
import { NoticeBox } from '@ui/features/devices/components/notice-box.tsx'
import type { ListedDevice } from '@ui/hooks/queries/use-devices.ts'

type ChecklistNoticeBodyProps = { udid: string; device: ListedDevice }

/**
 * What IPAForge sees left on a ready device (LocalDevVPN, say), with Show the checklist. A device that isn't ready
 * has its own notice already (unlock it, trust, Developer Mode), so this waits for it.
 */
export const ChecklistNoticeBody = ({
  udid,
  device
}: ChecklistNoticeBodyProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { view, progress } = useDeviceChecklist(udid, device)
  const onShow = () => void navigate({ to: '/devices' })

  if (view.state !== 'ready' || progress.seenLeft === 0) return null

  return (
    <NoticeBox
      status="warning"
      title={t('checklist.notice', {
        count: progress.seenLeft,
        device: view.name
      })}
      body={t('checklist.noticeBody')}
      action={
        <Button size="sm" variant="secondary" onPress={onShow}>
          {t('checklist.showChecklist')}
        </Button>
      }
    />
  )
}

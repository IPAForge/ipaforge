import { ChecklistNoticeBody } from '@ui/features/devices/checklist/components/checklist-notice-body.tsx'
import { useDeviceInUse } from '@ui/hooks/use-selection.ts'

/** On Install and Preload: what's left to do on the device in use, with a way to its checklist. */
export const ChecklistNotice = () => {
  const inUse = useDeviceInUse()

  if (!inUse?.device) return null

  return <ChecklistNoticeBody udid={inUse.udid} device={inUse.device} />
}

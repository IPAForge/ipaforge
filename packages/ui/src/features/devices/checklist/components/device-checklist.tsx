import { Button, ProgressBar } from '@heroui/react'
import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChecklistLine } from '@ui/features/devices/checklist/components/checklist-line.tsx'
import {
  CHECKLIST_GROUPS,
  checklistGroups
} from '@ui/features/devices/checklist/constants.ts'
import { useDeviceChecklist } from '@ui/features/devices/checklist/hooks/use-device-checklist.ts'
import type { ListedDevice } from '@ui/hooks/queries/use-devices.ts'
import { useActiveAccount } from '@ui/hooks/use-selection.ts'

type DeviceChecklistProps = {
  udid: string
  device: ListedDevice | undefined
}

/**
 * On a device: what it needs for its iOS version, grouped (before installing, after, for SideStore), how far along
 * it is, and each step. Once everything is done it folds into one line, "set up", with Show checklist.
 */
export const DeviceChecklist = ({ udid, device }: DeviceChecklistProps) => {
  const { t } = useTranslation()
  const account = useActiveAccount()
  const { view, version, items, progress, tick } = useDeviceChecklist(
    udid,
    device
  )
  const [isOpen, setOpen] = useState(false)
  const onToggle = () => setOpen((open) => !open)
  const title = t('checklist.title', { device: view.name, ios: version ?? '?' })
  const appleId = account?.appleId ?? ''

  if (!device || !view.check) return null

  if (progress.left === 0 && !isOpen)
    return (
      <section
        aria-label={title}
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
      >
        <CircleCheck
          aria-hidden="true"
          className="size-5 text-success-soft-foreground"
        />
        <span className="min-w-0 flex-1 basis-48">
          {t('checklist.setUp', { device: view.name, ios: version ?? '?' })}
        </span>
        <Button size="sm" variant="tertiary" onPress={onToggle}>
          {t('checklist.show')}
        </Button>
      </section>
    )

  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-muted text-sm">
          {progress.left === 0
            ? t('checklist.allSet')
            : t('checklist.progress', {
                left: progress.left,
                done: progress.done,
                total: progress.total
              })}
        </span>
        {progress.left === 0 ? (
          <Button size="sm" variant="tertiary" onPress={onToggle}>
            {t('checklist.hide')}
          </Button>
        ) : null}
      </div>
      <ProgressBar
        aria-label={title}
        value={progress.total ? (progress.done / progress.total) * 100 : 100}
        size="sm"
        color="success"
      >
        <ProgressBar.Track className="rounded-none">
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      {CHECKLIST_GROUPS.map((group) => {
        const inGroup = items.filter((item) => item.group === group)

        if (inGroup.length === 0) return null

        return (
          <div key={group}>
            <h3 className="border-border border-t bg-surface-secondary px-4 py-1.5 text-muted text-xs uppercase tracking-wide">
              {t(checklistGroups[group])}
            </h3>
            <ul
              aria-label={t(checklistGroups[group])}
              className="divide-y divide-border"
            >
              {inGroup.map((item) => (
                <ChecklistLine
                  key={item.id}
                  item={item}
                  udid={udid}
                  device={view.name}
                  appleId={appleId}
                  onTick={tick}
                />
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

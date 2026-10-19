import { Checkbox, Label } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { ChecklistAction } from '@ui/features/devices/checklist/components/checklist-action.tsx'
import { checklistLooks } from '@ui/features/devices/checklist/constants.ts'
import type { ChecklistItem } from '@ui/features/devices/checklist/types.ts'

type ChecklistLineProps = {
  item: ChecklistItem
  udid: string
  device: string
  appleId: string
  onTick: (id: string, isTicked: boolean) => void
}

/**
 * One step: its mark, what it is and how it stands; what to do (the taps on the iPhone) until it's done, and what
 * IPAForge can do for it. A step only you can see has a box to tick.
 */
export const ChecklistLine = ({
  item,
  udid,
  device,
  appleId,
  onTick
}: ChecklistLineProps) => {
  const { t } = useTranslation()
  const look = checklistLooks[item.state]
  const Icon = look.icon
  const values = { device, appleId }
  const isDone = item.state === 'done'
  const steps = item.howKeys ?? []
  const [only] = steps
  const onTickChange = (isTicked: boolean) => onTick(item.id, isTicked)

  return (
    <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 px-4 py-3">
      <Icon aria-hidden="true" className={`mt-0.5 size-5 ${look.tone}`} />
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className={isDone ? 'text-muted' : 'font-semibold'}>
          {t(item.titleKey, values)}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${look.tag}`}>
          {t(item.tagKey, values)}
        </span>
      </div>
      {!isDone && only && steps.length === 1 ? (
        <p className="col-start-2 text-muted text-sm">{t(only, values)}</p>
      ) : null}
      {!isDone && steps.length > 1 ? (
        <ol className="col-start-2 flex list-decimal flex-col gap-0.5 ps-5 text-muted text-sm">
          {steps.map((step) => (
            <li key={step}>{t(step, values)}</li>
          ))}
        </ol>
      ) : null}
      {!isDone && item.action ? (
        <div className="col-start-2 mt-1">
          <ChecklistAction action={item.action} udid={udid} />
        </div>
      ) : null}
      {item.isTickable ? (
        <Checkbox
          isSelected={isDone}
          onChange={onTickChange}
          className="col-start-2 mt-1 flex w-fit flex-row items-center gap-2"
        >
          <Checkbox.Control className="shrink-0">
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Checkbox.Content>
            <Label className="text-sm">{t('checklist.tick')}</Label>
          </Checkbox.Content>
        </Checkbox>
      ) : null}
    </li>
  )
}

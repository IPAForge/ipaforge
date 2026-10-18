import { ListBox, Select } from '@heroui/react'
import type { Key } from 'react'
import { useTranslation } from 'react-i18next'

import {
  ALL_AREAS,
  LOG_AREA_KEYS,
  LOG_AREAS
} from '@ui/features/logs/constants.ts'
import type { LogArea } from '@ui/state/log-view/types.ts'

type LogAreaSelectProps = {
  value: LogArea | undefined
  onChange: (area: LogArea | undefined) => void
}

/** Lines from one part of the app (install, device, Apple…), or from all of them. */
export const LogAreaSelect = ({ value, onChange }: LogAreaSelectProps) => {
  const { t } = useTranslation()
  const onSelect = (key: Key | null) =>
    onChange(LOG_AREAS.find((area) => area === key))

  return (
    <Select
      aria-label={t('logs.area.label')}
      value={value ?? ALL_AREAS}
      onChange={onSelect}
      className="w-40"
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id={ALL_AREAS} textValue={t('logs.area.all')}>
            {t('logs.area.all')}
            <ListBox.ItemIndicator />
          </ListBox.Item>
          {LOG_AREAS.map((area) => (
            <ListBox.Item
              key={area}
              id={area}
              textValue={t(LOG_AREA_KEYS[area])}
            >
              {t(LOG_AREA_KEYS[area])}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

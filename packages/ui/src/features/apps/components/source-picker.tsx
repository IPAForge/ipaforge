import { ListBox, Select } from '@heroui/react'
import type { Key } from 'react'
import { useTranslation } from 'react-i18next'

import type { SourceChoice } from '@ui/features/apps/types.ts'

type SourcePickerProps = {
  choices: readonly SourceChoice[]
  picked: number
  isDisabled: boolean
  onChange: (key: Key | null) => void
}

/** Which source Refresh installs an app from, when several list it: each with the version it would install. */
export const SourcePicker = ({
  choices,
  picked,
  isDisabled,
  onChange
}: SourcePickerProps) => {
  const { t } = useTranslation()

  return (
    <Select
      aria-label={t('apps.others.pickSource')}
      value={String(picked)}
      onChange={onChange}
      isDisabled={isDisabled}
      className="w-full max-w-sm"
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {choices.map((choice, index) => {
            const label = t('apps.others.choice', {
              source: choice.from,
              version: choice.version
            })

            return (
              <ListBox.Item
                key={choice.from}
                id={String(index)}
                textValue={label}
              >
                {label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )
          })}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

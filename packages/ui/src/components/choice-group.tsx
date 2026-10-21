import { ToggleButton, ToggleButtonGroup } from '@heroui/react'
import type { Key } from 'react'
import { useTranslation } from 'react-i18next'

import type { TranslationKey } from '@ui/i18n/setup/types.ts'

type ChoiceGroupProps<T extends string> = {
  /** The id of what names the group (a setting row's title). */
  labelledBy: string
  options: readonly T[]
  optionLabelKey: (option: T) => TranslationKey
  value: T
  onChange: (value: T) => void
}

/** A single-choice row of toggle buttons; selecting the current choice again keeps it. */
export const ChoiceGroup = <T extends string>({
  labelledBy,
  options,
  optionLabelKey,
  value,
  onChange
}: ChoiceGroupProps<T>) => {
  const { t } = useTranslation()
  const onSelectionChange = (keys: Set<Key>) => {
    const [selected] = keys
    const option = options.find((candidate) => candidate === selected)
    if (option) onChange(option)
  }

  return (
    <ToggleButtonGroup
      aria-labelledby={labelledBy}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={onSelectionChange}
      className="flex-wrap"
    >
      {options.map((option) => (
        <ToggleButton key={option} id={option}>
          {t(optionLabelKey(option))}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}

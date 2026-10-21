import { Checkbox, Label } from '@heroui/react'
import { useTranslation } from 'react-i18next'

type SaveIpaCheckboxProps = {
  name: string
  isSelected: boolean
  onChange: (isSelected: boolean) => void
}

/** Save signed .ipa instead: the app is signed and saved on the computer, not installed on the device. */
export const SaveIpaCheckbox = ({
  name,
  isSelected,
  onChange
}: SaveIpaCheckboxProps) => {
  const { t } = useTranslation()

  return (
    <Checkbox
      isSelected={isSelected}
      onChange={onChange}
      aria-label={t('preload.row.saveInsteadOne', { name })}
      className="flex flex-row items-center gap-2"
    >
      <Checkbox.Control className="shrink-0">
        <Checkbox.Indicator />
      </Checkbox.Control>
      <Checkbox.Content>
        <Label className="text-muted text-xs">
          {t('preload.row.saveInstead')}
        </Label>
      </Checkbox.Content>
    </Checkbox>
  )
}

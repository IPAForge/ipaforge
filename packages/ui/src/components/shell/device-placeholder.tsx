import { Dropdown } from '@heroui/react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { TopBarPicker } from '@ui/components/shell/top-bar-picker.tsx'

/** The Device picker until the device picker lands: "None", and one disabled item. */
export const DevicePlaceholder = () => {
  const { t } = useTranslation()
  const item = t('topBar.devicesFound', { count: 0 })
  const id = useId()

  return (
    <TopBarPicker
      label={t('topBar.device')}
      value={t('topBar.noDevice')}
      tone="off"
      menuLabel={t('topBar.deviceMenu')}
    >
      <Dropdown.Section>
        <Dropdown.Item id={id} isDisabled textValue={item}>
          {item}
        </Dropdown.Item>
      </Dropdown.Section>
    </TopBarPicker>
  )
}

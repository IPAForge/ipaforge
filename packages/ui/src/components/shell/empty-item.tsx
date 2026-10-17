import { Dropdown } from '@heroui/react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

/** The device menu with no device connected, and how to connect one. */
export const EmptyItem = () => {
  const { t } = useTranslation()
  const id = useId()

  return (
    <Dropdown.Item id={id} isDisabled textValue={t('devices.empty.title')}>
      <div className="flex min-w-0 flex-col">
        <span>{t('devices.empty.title')}</span>
        <span className="whitespace-normal text-muted text-xs">
          {t('topBar.noDevicesHint')}
        </span>
      </div>
    </Dropdown.Item>
  )
}

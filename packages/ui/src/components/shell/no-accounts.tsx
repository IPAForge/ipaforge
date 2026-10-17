import { Dropdown } from '@heroui/react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

/** The Apple ID menu with nothing saved yet. */
export const NoAccounts = () => {
  const { t } = useTranslation()
  const id = useId()

  return (
    <Dropdown.Item id={id} isDisabled textValue={t('topBar.noAccounts')}>
      <span className="text-muted text-sm">{t('topBar.noAccounts')}</span>
    </Dropdown.Item>
  )
}

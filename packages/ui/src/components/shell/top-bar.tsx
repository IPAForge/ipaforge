import { useTranslation } from 'react-i18next'

import { AccountPicker } from '@ui/components/shell/account-picker.tsx'
import { DevicePlaceholder } from '@ui/components/shell/device-placeholder.tsx'

/** The app name on the start side, the device and Apple ID pickers on the end side. The device one is a placeholder. */
export const TopBar = () => {
  const { t } = useTranslation()

  return (
    <header className="flex flex-wrap items-center gap-3 border-border border-b bg-surface px-4 py-2">
      <span className="me-auto font-semibold">{t('app.name')}</span>
      <DevicePlaceholder />
      <AccountPicker />
    </header>
  )
}

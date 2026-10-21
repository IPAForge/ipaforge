import { useTranslation } from 'react-i18next'

import { AccountPicker } from '@ui/components/shell/account-picker.tsx'
import { AppLogo } from '@ui/components/shell/app-logo.tsx'
import { DevicePicker } from '@ui/components/shell/device-picker.tsx'
import { TourButton } from '@ui/features/tour/components/tour-button.tsx'

/** The app's mark and name on the start side; the device and Apple ID pickers and the tour's button on the end side. */
export const TopBar = () => {
  const { t } = useTranslation()

  return (
    <header className="flex flex-wrap items-center gap-3 border-border border-b bg-surface px-4 py-2">
      <span className="me-auto flex items-center gap-2 font-semibold">
        <AppLogo />
        {t('app.name')}
      </span>
      <div data-tour="pickers" className="flex flex-wrap items-center gap-3">
        <DevicePicker />
        <AccountPicker />
      </div>
      <TourButton />
    </header>
  )
}

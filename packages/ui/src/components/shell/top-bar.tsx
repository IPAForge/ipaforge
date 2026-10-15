import { useTranslation } from 'react-i18next'

import {
  TopBarPicker,
  type TopBarPickerProps
} from '@ui/components/shell/top-bar-picker.tsx'

/** The device and Apple ID pickers: placeholders until the Engine client is wired in (6c). */
const pickers = [
  {
    id: 'device',
    labelKey: 'topBar.device',
    valueKey: 'topBar.noDevice',
    isOn: false,
    menuLabelKey: 'topBar.deviceMenu',
    emptyItemKey: 'topBar.devicesFound',
    emptyItemCount: 0
  },
  {
    id: 'account',
    labelKey: 'topBar.account',
    valueKey: 'topBar.notSignedIn',
    isOn: false,
    menuLabelKey: 'topBar.accountMenu',
    emptyItemKey: 'topBar.addAppleIdSoon'
  }
] as const satisfies readonly TopBarPickerProps[]

/** The app name on the start side, the device and Apple ID pickers on the end side. */
export const TopBar = () => {
  const { t } = useTranslation()

  return (
    <header className="flex flex-wrap items-center gap-3 border-border border-b bg-surface px-4 py-2">
      <span className="me-auto font-semibold">{t('app.name')}</span>
      {pickers.map((picker) => (
        <TopBarPicker key={picker.id} {...picker} />
      ))}
    </header>
  )
}

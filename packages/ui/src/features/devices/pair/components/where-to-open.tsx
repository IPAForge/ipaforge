import { useTranslation } from 'react-i18next'

import { DeviceKindIcon } from '@ui/features/devices/components/device-kind-icon.tsx'
import { pairingScreens } from '@ui/features/devices/pair/constants.ts'

/** Where Apple TV and Apple Vision Pro open their pairing screen: each one's icon, its name under it, the path. */
export const WhereToOpen = () => {
  const { t } = useTranslation()

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {pairingScreens.map(({ kind, nameKey, pathKey }) => (
        <li
          key={kind}
          className="flex min-w-0 flex-col gap-1.5 rounded-xl bg-surface-secondary px-3.5 py-3"
        >
          <DeviceKindIcon kind={kind} className="size-7 text-muted" />
          <span className="font-medium">{t(nameKey)}</span>
          <span className="text-sm">{t(pathKey)}</span>
        </li>
      ))}
    </ul>
  )
}

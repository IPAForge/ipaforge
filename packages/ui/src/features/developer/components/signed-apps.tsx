import { useTranslation } from 'react-i18next'

import type { InstalledApp } from '@ui/services/engine/types.ts'

type SignedAppsProps = {
  apps: readonly InstalledApp[]
  deviceName: string
}

/** The apps on the device that stop opening when a certificate is revoked, or that none do. */
export const SignedApps = ({ apps, deviceName }: SignedAppsProps) => {
  const { t } = useTranslation()
  if (apps.length === 0)
    return <p>{t('portal.revokeDialog.none', { device: deviceName })}</p>

  return (
    <>
      <p>{t('portal.revokeDialog.apps', { device: deviceName })}</p>
      <ul className="list-disc ps-5">
        {apps.map((app) => (
          <li key={app.bundleId}>{app.name}</li>
        ))}
      </ul>
    </>
  )
}
